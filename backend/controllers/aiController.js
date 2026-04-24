const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const User = require('../models/User');

const getClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key') return null;
  return new GoogleGenerativeAI(key);
};

// ── Aggregate order analytics for the given retailer (or all if admin) ──────
const buildAnalytics = async (userId, role) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  const allOrders = await Order.find({
    createdAt: { $gte: sixMonthsAgo },
    status: { $nin: ['cancelled'] },
  }).lean();

  const relevant = allOrders.flatMap(order =>
    order.items
      .filter(item => role === 'admin' || String(item.retailer) === String(userId))
      .map(item => ({
        ...item,
        orderId: order._id,
        createdAt: order.createdAt,
        country: order.shippingAddress?.country || 'Unknown',
        city: order.shippingAddress?.city || 'Unknown',
        state: order.shippingAddress?.state || 'Unknown',
      }))
  );

  // Sales by product
  const byProduct = {};
  for (const item of relevant) {
    const key = String(item.product);
    if (!byProduct[key]) {
      byProduct[key] = { name: item.name, category: item.category || 'unknown', totalQty: 0, totalRevenue: 0, months: {} };
    }
    byProduct[key].totalQty += item.quantity;
    byProduct[key].totalRevenue += item.price * item.quantity;
    const month = item.createdAt.toISOString().slice(0, 7);
    byProduct[key].months[month] = (byProduct[key].months[month] || 0) + item.quantity;
  }

  // Sales by category
  const byCategory = {};
  for (const p of Object.values(byProduct)) {
    const c = p.category;
    if (!byCategory[c]) byCategory[c] = { totalQty: 0, totalRevenue: 0 };
    byCategory[c].totalQty += p.totalQty;
    byCategory[c].totalRevenue += p.totalRevenue;
  }

  // Regions breakdown
  const regions = {};
  for (const item of relevant) {
    const r = `${item.city}, ${item.country}`;
    regions[r] = (regions[r] || 0) + item.quantity;
  }
  const topRegions = Object.entries(regions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([region, qty]) => ({ region, qty }));

  // Current stock snapshot
  const stockQuery = role === 'admin' ? {} : { retailer: userId };
  const products = await Product.find(stockQuery).lean();
  const stockSnapshot = products.map(p => ({
    id: String(p._id),
    name: p.name,
    category: p.category,
    stock: p.stock,
    unit: p.unit,
    price: p.price,
  }));

  const topProducts = Object.entries(byProduct)
    .sort((a, b) => b[1].totalQty - a[1].totalQty)
    .slice(0, 15)
    .map(([id, data]) => ({ id, ...data }));

  return { topProducts, byCategory, topRegions, stockSnapshot };
};

// ── Gemini response schema ────────────────────────────────────────────────────
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    executiveSummary: { type: SchemaType.STRING },
    seasonalContext: { type: SchemaType.STRING },
    restockRecommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          productId: { type: SchemaType.STRING },
          productName: { type: SchemaType.STRING },
          currentStock: { type: SchemaType.NUMBER },
          suggestedRestockQty: { type: SchemaType.NUMBER },
          urgency: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
          estimatedDaysUntilStockout: { type: SchemaType.NUMBER },
        },
        required: ['productId', 'productName', 'currentStock', 'suggestedRestockQty', 'urgency', 'reason'],
      },
    },
    demandForecast: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING },
          trend: { type: SchemaType.STRING },
          forecastNextMonth: { type: SchemaType.STRING },
          actionableInsight: { type: SchemaType.STRING },
        },
        required: ['category', 'trend', 'forecastNextMonth', 'actionableInsight'],
      },
    },
    wasteReductionTips: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    opportunityAlerts: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          potentialRevenue: { type: SchemaType.STRING },
        },
        required: ['title', 'description'],
      },
    },
  },
  required: ['executiveSummary', 'seasonalContext', 'restockRecommendations', 'demandForecast', 'wasteReductionTips', 'opportunityAlerts'],
};

// ── GET /api/ai/insights ─────────────────────────────────────────────────────
exports.getInsights = async (req, res, next) => {
  try {
    const genAI = getClient();
    if (!genAI) {
      return res.status(503).json({
        message: 'AI assistant not configured. Add GEMINI_API_KEY to your .env file. Get a free key at aistudio.google.com',
        demo: true,
      });
    }

    const analytics = await buildAnalytics(req.user._id, req.user.role);
    const today = new Date().toISOString().split('T')[0];

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `You are HarvestHub's AI business assistant — an expert agricultural market analyst and inventory optimization specialist. Today is ${today}.

Your role is to help fresh produce retailers:
- Predict upcoming demand spikes from seasons, regional festivals, and local occasions
- Recommend exact restock quantities to prevent both stockouts and overstock waste
- Identify untapped revenue opportunities
- Reduce food waste through smart inventory timing

Key principles:
- Fresh produce has very short shelf life — over-stocking is as harmful as under-stocking
- Regional festivals and cultural occasions cause predictable demand spikes (Diwali, Eid, Christmas, Thanksgiving, local harvest festivals, etc.)
- Always provide specific, actionable numbers — not vague advice
- Urgency values must be exactly one of: critical, high, medium, low
- Trend values must be exactly one of: rising, stable, declining`,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });

    const prompt = `Analyze this business data and generate inventory intelligence recommendations:

## Sales Analytics (Last 6 Months)

### Top Selling Products by Volume:
${JSON.stringify(analytics.topProducts, null, 2)}

### Category Performance:
${JSON.stringify(analytics.byCategory, null, 2)}

### Customer Regions:
${JSON.stringify(analytics.topRegions, null, 2)}

### Current Inventory Snapshot:
${JSON.stringify(analytics.stockSnapshot, null, 2)}

Based on this data:
1. Identify which products are at risk of stockout given their recent sales velocity
2. Consider what seasonal/festival demand is coming in the next 4-6 weeks for these regions
3. Recommend specific restock quantities for each at-risk or opportunity product
4. Flag any products with excess stock that may spoil
5. Highlight revenue opportunities (new products to add, seasonal promotions)`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const recommendations = JSON.parse(text);

    res.json({
      recommendations,
      meta: {
        generatedAt: new Date().toISOString(),
        dataPoints: analytics.topProducts.length,
        productsAnalyzed: analytics.stockSnapshot.length,
        model: 'gemini-1.5-flash',
        tokensUsed: result.response.usageMetadata?.totalTokenCount ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/ai/restock ─────────────────────────────────────────────────────
exports.applyRestock = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const results = [];
    for (const { productId, quantity } of items) {
      if (!productId || !quantity || quantity <= 0) continue;

      const filter = { _id: productId };
      if (req.user.role !== 'admin') filter.retailer = req.user._id;

      const product = await Product.findOneAndUpdate(
        filter,
        { $inc: { stock: Number(quantity) } },
        { new: true }
      );

      if (product) {
        results.push({ productId, name: product.name, newStock: product.stock, added: Number(quantity) });
      }
    }

    res.json({ restocked: results, count: results.length });
  } catch (err) {
    next(err);
  }
};

// ── Shared helper ─────────────────────────────────────────────────────────────
const noAI = (res) => res.status(503).json({
  message: 'AI assistant not configured. Add GEMINI_API_KEY to your .env file.',
  demo: true,
});

const gemini = (systemInstruction, schema, temperature = 0.4) => {
  const genAI = getClient();
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER AI FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/ai/recommendations ─────────────────────────────────────────────
exports.getRecommendations = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a smart produce recommendation engine for an online fresh food store. Recommend products the customer will love based on their history and current cart.',
      {
        type: SchemaType.OBJECT,
        properties: {
          recommendations: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                productId: { type: SchemaType.STRING },
                name: { type: SchemaType.STRING },
                reason: { type: SchemaType.STRING },
                category: { type: SchemaType.STRING },
              },
              required: ['productId', 'name', 'reason', 'category'],
            },
          },
          message: { type: SchemaType.STRING },
        },
        required: ['recommendations', 'message'],
      }
    );
    if (!model) return noAI(res);

    const { cartItems = [] } = req.body;
    const pastOrders = await Order.find({ user: req.user._id, isPaid: true })
      .sort({ createdAt: -1 }).limit(10).lean();
    const boughtCategories = [...new Set(pastOrders.flatMap(o => o.items.map(i => i.category)).filter(Boolean))];
    const boughtNames = [...new Set(pastOrders.flatMap(o => o.items.map(i => i.name)))].slice(0, 20);
    const allProducts = await Product.find({ stock: { $gt: 0 } }).select('_id name category price unit').lean();

    const prompt = `Customer's past purchase categories: ${boughtCategories.join(', ') || 'none yet'}.
Recently bought products: ${boughtNames.join(', ') || 'none'}.
Current cart items: ${cartItems.map(i => i.name).join(', ') || 'empty'}.
Available products: ${JSON.stringify(allProducts.map(p => ({ id: p._id, name: p.name, category: p.category, price: p.price })))}.
Recommend up to 8 products the customer would enjoy. Avoid recommending items already in their cart.`;

    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ── POST /api/ai/search ───────────────────────────────────────────────────────
exports.naturalLanguageSearch = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ message: 'Search query is required' });

    const model = gemini(
      'You are a natural language search engine for a fresh produce store. Interpret the user\'s query and return relevant product IDs ranked by relevance.',
      {
        type: SchemaType.OBJECT,
        properties: {
          productIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          interpretation: { type: SchemaType.STRING },
          filters: {
            type: SchemaType.OBJECT,
            properties: {
              categories: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              maxPrice: { type: SchemaType.NUMBER },
            },
          },
        },
        required: ['productIds', 'interpretation'],
      }
    );
    if (!model) return noAI(res);

    const allProducts = await Product.find({ stock: { $gt: 0 } }).select('_id name description category price unit').lean();
    const prompt = `User search query: "${query}"
Available products: ${JSON.stringify(allProducts.map(p => ({ id: p._id, name: p.name, description: p.description?.slice(0, 80), category: p.category, price: p.price })))}
Return the IDs of matching products ordered by relevance. Interpret the user's intent (e.g. "salad ingredients" → lettuce, tomato, cucumber, etc).`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    const orderedProducts = parsed.productIds
      .map(id => allProducts.find(p => p._id.toString() === id))
      .filter(Boolean);
    res.json({ products: orderedProducts, interpretation: parsed.interpretation, filters: parsed.filters });
  } catch (err) { next(err); }
};

// ── POST /api/ai/freshness ────────────────────────────────────────────────────
exports.getFreshnessAdvice = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a fresh produce expert. Give practical shelf life and storage advice for grocery items.',
      {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                shelfLifeDays: { type: SchemaType.NUMBER },
                storageMethod: { type: SchemaType.STRING },
                freshnessTip: { type: SchemaType.STRING },
                freezable: { type: SchemaType.STRING },
              },
              required: ['name', 'shelfLifeDays', 'storageMethod', 'freshnessTip'],
            },
          },
          generalTip: { type: SchemaType.STRING },
        },
        required: ['items', 'generalTip'],
      }
    );
    if (!model) return noAI(res);

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'items array is required' });

    const result = await model.generateContent(
      `Give shelf life and storage advice for these fresh produce items: ${items.map(i => i.name || i).join(', ')}.`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ── POST /api/ai/recipes ──────────────────────────────────────────────────────
exports.getRecipeSuggestions = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a friendly home cooking assistant. Suggest simple, healthy recipes using the provided fresh ingredients.',
      {
        type: SchemaType.OBJECT,
        properties: {
          recipes: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                cookTime: { type: SchemaType.STRING },
                difficulty: { type: SchemaType.STRING },
                usesFromCart: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                missingIngredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ['name', 'cookTime', 'difficulty', 'usesFromCart', 'missingIngredients', 'steps'],
            },
          },
        },
        required: ['recipes'],
      },
      0.7
    );
    if (!model) return noAI(res);

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'items array is required' });

    const result = await model.generateContent(
      `I have these ingredients: ${items.map(i => i.name || i).join(', ')}. Suggest 3 simple recipes I can make. For each recipe, list which of my ingredients it uses and what else I might need.`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
exports.chatSupport = async (req, res, next) => {
  try {
    const model = gemini(
      `You are HarvestHub's friendly AI support assistant for a fresh produce delivery platform.
You help customers with: order status, returns/refunds, delivery questions, product questions, account help.
If a customer asks about a specific order status, check the provided order context.
Be warm, concise, and helpful. If you cannot resolve the issue, suggest they submit a support ticket.
Never make up information — if you don't know, say so and offer to escalate.`,
      {
        type: SchemaType.OBJECT,
        properties: {
          reply: { type: SchemaType.STRING },
          intent: { type: SchemaType.STRING },
          canResolve: { type: SchemaType.STRING },
          suggestedAction: { type: SchemaType.STRING },
        },
        required: ['reply', 'intent', 'canResolve'],
      },
      0.6
    );
    if (!model) return noAI(res);

    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'message is required' });

    const recentOrders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 }).limit(5)
      .select('_id status isPaid totalPrice createdAt').lean();

    const context = `Customer: ${req.user.name} (${req.user.role}).
Recent orders: ${recentOrders.map(o => `#${o._id.toString().slice(-6).toUpperCase()} - ${o.status} - $${o.totalPrice?.toFixed(2)} - ${new Date(o.createdAt).toLocaleDateString()}`).join('; ') || 'No orders yet'}.
${history.length ? `Conversation so far: ${history.map(h => `${h.role}: ${h.text}`).join('\n')}` : ''}
Customer says: "${message}"`;

    const result = await model.generateContent(context);
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// RETAILER AI FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/ai/pricing ───────────────────────────────────────────────────────
exports.getDynamicPricing = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a dynamic pricing expert for a fresh produce marketplace. Suggest optimal pricing based on stock levels, demand trends, and produce perishability.',
      {
        type: SchemaType.OBJECT,
        properties: {
          suggestions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                productId: { type: SchemaType.STRING },
                productName: { type: SchemaType.STRING },
                currentPrice: { type: SchemaType.NUMBER },
                suggestedPrice: { type: SchemaType.NUMBER },
                action: { type: SchemaType.STRING },
                reason: { type: SchemaType.STRING },
                urgency: { type: SchemaType.STRING },
              },
              required: ['productId', 'productName', 'currentPrice', 'suggestedPrice', 'action', 'reason', 'urgency'],
            },
          },
          summary: { type: SchemaType.STRING },
        },
        required: ['suggestions', 'summary'],
      }
    );
    if (!model) return noAI(res);

    const stockQuery = req.user.role === 'admin' ? {} : { retailer: req.user._id };
    const products = await Product.find(stockQuery).lean();
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const orders = await Order.find({ createdAt: { $gte: sixMonthsAgo }, status: { $nin: ['cancelled'] } }).lean();

    const salesByProduct = {};
    orders.forEach(o => o.items.forEach(item => {
      const key = String(item.product);
      salesByProduct[key] = (salesByProduct[key] || 0) + item.quantity;
    }));

    const productContext = products.map(p => ({
      id: p._id, name: p.name, category: p.category,
      currentPrice: p.price, stock: p.stock, unit: p.unit,
      unitsSoldLast6Months: salesByProduct[String(p._id)] || 0,
    }));

    const result = await model.generateContent(
      `Today is ${new Date().toISOString().split('T')[0]}. Analyze these products and suggest price adjustments.
Consider: high stock + low sales = discount to prevent waste. Low stock + high demand = slight increase.
Products: ${JSON.stringify(productContext)}`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ── POST /api/ai/generate-description ────────────────────────────────────────
exports.generateProductDescription = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a copywriter for a fresh produce marketplace. Write appealing, accurate product descriptions that highlight freshness, taste, and nutritional value.',
      {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          highlights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          suggestedUnit: { type: SchemaType.STRING },
          storageNote: { type: SchemaType.STRING },
        },
        required: ['name', 'description', 'highlights', 'suggestedUnit'],
      },
      0.7
    );
    if (!model) return noAI(res);

    const { name, category, price, unit } = req.body;
    if (!name || !category) return res.status(400).json({ message: 'name and category are required' });

    const result = await model.generateContent(
      `Write a product listing for: "${name}" (${category}, $${price || '?'}/${unit || 'unit'}).
Include a compelling 2-3 sentence description, 3-4 bullet point highlights, and a storage note.`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ── GET /api/ai/sentiment ─────────────────────────────────────────────────────
exports.getReviewSentiment = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a customer feedback analyst for a fresh produce marketplace. Analyze reviews and provide actionable insights for retailers.',
      {
        type: SchemaType.OBJECT,
        properties: {
          products: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                productId: { type: SchemaType.STRING },
                productName: { type: SchemaType.STRING },
                overallSentiment: { type: SchemaType.STRING },
                averageRating: { type: SchemaType.NUMBER },
                positiveThemes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                negativeThemes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                actionableSuggestion: { type: SchemaType.STRING },
              },
              required: ['productId', 'productName', 'overallSentiment', 'averageRating', 'positiveThemes', 'negativeThemes', 'actionableSuggestion'],
            },
          },
          overallHealth: { type: SchemaType.STRING },
        },
        required: ['products', 'overallHealth'],
      }
    );
    if (!model) return noAI(res);

    const productFilter = req.user.role === 'admin' ? {} : { retailer: req.user._id };
    const myProducts = await Product.find(productFilter).select('_id name').lean();
    const productIds = myProducts.map(p => p._id);
    const reviews = await Review.find({ product: { $in: productIds } }).lean();

    if (reviews.length === 0) return res.json({ products: [], overallHealth: 'No reviews yet — keep growing your customer base!' });

    const grouped = {};
    reviews.forEach(r => {
      const key = String(r.product);
      if (!grouped[key]) grouped[key] = { name: myProducts.find(p => String(p._id) === key)?.name, reviews: [] };
      grouped[key].reviews.push({ rating: r.rating, comment: r.comment });
    });

    const result = await model.generateContent(
      `Analyze these product reviews and identify sentiment patterns: ${JSON.stringify(grouped)}`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY AI FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/ai/route-optimize ───────────────────────────────────────────────
exports.optimizeRoute = async (req, res, next) => {
  try {
    const model = gemini(
      'You are a delivery route optimization assistant. Given a list of delivery addresses, suggest the most efficient delivery order to minimize total travel distance and time.',
      {
        type: SchemaType.OBJECT,
        properties: {
          optimizedRoute: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                step: { type: SchemaType.NUMBER },
                orderId: { type: SchemaType.STRING },
                address: { type: SchemaType.STRING },
                customer: { type: SchemaType.STRING },
                estimatedMinutes: { type: SchemaType.NUMBER },
                tip: { type: SchemaType.STRING },
              },
              required: ['step', 'orderId', 'address', 'customer', 'estimatedMinutes'],
            },
          },
          totalEstimatedMinutes: { type: SchemaType.NUMBER },
          routingTips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['optimizedRoute', 'totalEstimatedMinutes', 'routingTips'],
      },
      0.3
    );
    if (!model) return noAI(res);

    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0)
      return res.status(400).json({ message: 'orderIds array is required' });

    const orders = await Order.find({
      _id: { $in: orderIds },
      deliveryPerson: req.user._id,
      status: { $in: ['shipped', 'out_for_delivery'] },
    }).populate('user', 'name').lean();

    if (orders.length === 0) return res.status(404).json({ message: 'No eligible orders found' });

    const deliveries = orders.map(o => ({
      orderId: String(o._id),
      customer: o.user?.name,
      address: `${o.shippingAddress?.street}, ${o.shippingAddress?.city}, ${o.shippingAddress?.state} ${o.shippingAddress?.zipCode}`,
      orderValue: o.totalPrice,
    }));

    const result = await model.generateContent(
      `Optimize the delivery sequence for these orders. Consider geographic clustering and suggest an efficient route order.
Deliveries: ${JSON.stringify(deliveries)}`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};

// ── GET /api/ai/earnings-tips ─────────────────────────────────────────────────
exports.getEarningsTips = async (req, res, next) => {
  try {
    const model = gemini(
      'You are an earnings coach for gig delivery workers on a fresh produce platform. Give specific, actionable advice to maximize earnings.',
      {
        type: SchemaType.OBJECT,
        properties: {
          weeklyForecast: { type: SchemaType.STRING },
          bestTimeSlots: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          earningsTips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          tipOptimizationAdvice: { type: SchemaType.STRING },
          performanceSummary: { type: SchemaType.STRING },
        },
        required: ['weeklyForecast', 'bestTimeSlots', 'earningsTips', 'tipOptimizationAdvice', 'performanceSummary'],
      },
      0.5
    );
    if (!model) return noAI(res);

    const allOrders = await Order.find({ deliveryPerson: req.user._id, status: 'delivered' })
      .sort({ createdAt: -1 }).limit(50).lean();

    const totalDeliveries = allOrders.length;
    const totalTips = allOrders.reduce((s, o) => s + (o.tip || 0), 0);
    const avgTip = totalDeliveries ? (totalTips / totalDeliveries).toFixed(2) : 0;
    const byHour = {}; const byDay = {};
    allOrders.forEach(o => {
      const h = new Date(o.deliveredAt || o.createdAt).getHours();
      const d = new Date(o.deliveredAt || o.createdAt).toLocaleDateString('en', { weekday: 'long' });
      byHour[h] = (byHour[h] || 0) + 1;
      byDay[d] = (byDay[d] || 0) + 1;
    });
    const topHours = Object.entries(byHour).sort((a,b) => b[1]-a[1]).slice(0,3).map(([h]) => `${h}:00`);
    const topDays = Object.entries(byDay).sort((a,b) => b[1]-a[1]).slice(0,3).map(([d]) => d);

    const result = await model.generateContent(
      `Delivery driver stats: ${totalDeliveries} total deliveries, $${totalTips.toFixed(2)} total tips, $${avgTip} avg tip.
Busiest hours: ${topHours.join(', ')}. Busiest days: ${topDays.join(', ')}.
Today is ${new Date().toLocaleDateString('en', { weekday: 'long' })}.
Give specific advice to help this driver earn more.`
    );
    res.json(JSON.parse(result.response.text()));
  } catch (err) { next(err); }
};
