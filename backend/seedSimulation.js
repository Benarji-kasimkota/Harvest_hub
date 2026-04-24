/**
 * HarvestHub — AI Simulation Dataset Seed
 *
 * Creates a full 6-month dataset designed to exercise every AI feature:
 *  - Inventory AI:     products with varied stock/velocity → restock alerts
 *  - Pricing Engine:   overstocked slow-movers vs. in-demand low-stock items
 *  - Recommendations:  per-user purchase history with clear preference patterns
 *  - Recipes/Freshness: diverse cart items across categories
 *  - Chatbot:          realistic order history with varied statuses
 *  - Sentiment:        reviews with themes (positive & negative)
 *  - Route Optimizer:  active deliveries across different city zones
 *  - Earnings Optimizer: delivery history with tips and time patterns
 *
 * Run: npm run seed:sim
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const dotenv   = require('dotenv');
dotenv.config();

const User          = require('./models/User');
const Product       = require('./models/Product');
const Order         = require('./models/Order');
const Review        = require('./models/Review');
const SupportTicket = require('./models/SupportTicket');

// ── Helpers ───────────────────────────────────────────────────────────────────
const pw    = (p = 'HarvestHub@123') => bcrypt.hashSync(p, 10);
const daysAgo  = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];

const CITIES = [
  { city: 'New York',     state: 'NY', zip: '10001', country: 'USA' },
  { city: 'Los Angeles',  state: 'CA', zip: '90001', country: 'USA' },
  { city: 'Chicago',      state: 'IL', zip: '60601', country: 'USA' },
  { city: 'Houston',      state: 'TX', zip: '77001', country: 'USA' },
  { city: 'Phoenix',      state: 'AZ', zip: '85001', country: 'USA' },
  { city: 'Philadelphia', state: 'PA', zip: '19101', country: 'USA' },
];

const STREETS = [
  '123 Main St', '456 Oak Ave', '789 Maple Rd', '321 Pine Blvd',
  '654 Elm St', '987 Cedar Lane', '147 Birch Way', '258 Spruce Dr',
];

// ── Main Seed ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(seed)
  .catch(err => { console.error('Connection error:', err); process.exit(1); });

async function seed() {
  console.log('\n🌱  HarvestHub AI Simulation Seed\n' + '─'.repeat(44));

  // ── Wipe existing simulation data ──────────────────────────────────────────
  await Promise.all([
    User.deleteMany({ email: /@sim\.harvesthub\.com$/ }),
    Product.deleteMany({ farmer: /Simulation/ }),
  ]);
  // Wipe all orders, reviews, tickets for a clean slate
  await Order.deleteMany({});
  await Review.deleteMany({});
  await SupportTicket.deleteMany({});
  console.log('🗑   Cleared previous simulation data');

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════
  const [retailerA, retailerB, retailerC] = await User.insertMany([
    { name: 'Green Valley Farm',    email: 'green@sim.harvesthub.com',    password: pw(), role: 'retailer', status: 'active', storeName: 'Green Valley Farm' },
    { name: 'Tropical Fruits Co',   email: 'tropical@sim.harvesthub.com', password: pw(), role: 'retailer', status: 'active', storeName: 'Tropical Fruits Co' },
    { name: 'Premier Proteins',     email: 'premier@sim.harvesthub.com',  password: pw(), role: 'retailer', status: 'active', storeName: 'Premier Proteins' },
  ]);

  const consumers = await User.insertMany([
    { name: 'Alice Johnson',  email: 'alice@sim.harvesthub.com',  password: pw(), role: 'consumer', status: 'active' },
    { name: 'Bob Martinez',   email: 'bob@sim.harvesthub.com',    password: pw(), role: 'consumer', status: 'active' },
    { name: 'Carol Williams', email: 'carol@sim.harvesthub.com',  password: pw(), role: 'consumer', status: 'active' },
    { name: 'David Chen',     email: 'david@sim.harvesthub.com',  password: pw(), role: 'consumer', status: 'active' },
    { name: 'Emma Brown',     email: 'emma@sim.harvesthub.com',   password: pw(), role: 'consumer', status: 'active' },
  ]);

  const drivers = await User.insertMany([
    { name: 'Fast Eddie',    email: 'eddie@sim.harvesthub.com',  password: pw(), role: 'delivery', status: 'active', isAvailable: true },
    { name: 'Quick Sarah',   email: 'sarah@sim.harvesthub.com',  password: pw(), role: 'delivery', status: 'active', isAvailable: false },
    { name: 'Speedy Mike',   email: 'mike@sim.harvesthub.com',   password: pw(), role: 'delivery', status: 'active', isAvailable: true },
  ]);

  console.log('👤  Created 3 retailers · 5 consumers · 3 drivers');

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS  (designed for interesting AI signals)
  // ═══════════════════════════════════════════════════════════════════════════
  const productDefs = [
    // GREEN VALLEY FARM — vegetables
    // High demand, CRITICALLY low stock → urgent restock
    { name: 'Organic Tomatoes',    category: 'vegetables', price: 3.49, stock: 4,   unit: 'kg',    retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=500&q=80', description: 'Sun-ripened organic tomatoes bursting with flavour. No pesticides, grown in nutrient-rich soil.', featured: true },
    // Moderate demand, decent stock
    { name: 'Fresh Broccoli',      category: 'vegetables', price: 2.99, stock: 85,  unit: 'kg',    retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=500&q=80', description: 'Crisp farm-fresh broccoli packed with vitamins C and K. Perfect for stir-fries and soups.', featured: true },
    // Very low sales, overstocked → suggest discount
    { name: 'Purple Kale',         category: 'vegetables', price: 4.99, stock: 210, unit: 'bunch', retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&q=80', description: 'Nutrient-dense purple kale, freshly cut. Rich in iron and antioxidants.' },
    // High demand, good stock
    { name: 'Baby Spinach',        category: 'vegetables', price: 2.49, stock: 55,  unit: 'bunch', retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&q=80', description: 'Tender baby spinach leaves, washed and ready to eat. Perfect for salads and smoothies.', featured: true },
    { name: 'Sweet Carrots',       category: 'vegetables', price: 1.99, stock: 140, unit: 'kg',    retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=500&q=80', description: 'Naturally sweet crunchy carrots freshly pulled from the earth. Rich in beta-carotene.' },

    // TROPICAL FRUITS CO — fruits
    // Peak summer seller, low stock → high urgency restock
    { name: 'Alphonso Mangoes',    category: 'fruits',     price: 7.99, stock: 8,   unit: 'kg',    retailer: retailerB._id, farmer: 'Tropical Fruits Co Simulation', image: 'https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=500&q=80', description: 'Premium Alphonso mangoes — the king of mangoes. Intensely sweet with a rich golden flesh.', featured: true },
    // High steady seller
    { name: 'Red Apples',          category: 'fruits',     price: 4.99, stock: 160, unit: 'kg',    retailer: retailerB._id, farmer: 'Tropical Fruits Co Simulation', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&q=80', description: 'Crisp and sweet red apples from high-altitude mountain orchards. Hand-picked at peak ripeness.', featured: true },
    { name: 'Fresh Strawberries',  category: 'fruits',     price: 5.99, stock: 35,  unit: 'punnet', retailer: retailerB._id, farmer: 'Tropical Fruits Co Simulation', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=500&q=80', description: 'Plump, juicy strawberries picked at peak ripeness. Perfect fresh or in desserts.', featured: true },
    // Poor seller, high stock
    { name: 'Dragon Fruit',        category: 'fruits',     price: 8.99, stock: 95,  unit: 'piece', retailer: retailerB._id, farmer: 'Tropical Fruits Co Simulation', image: 'https://images.unsplash.com/photo-1527325678964-54921661f888?w=500&q=80', description: 'Exotic dragon fruit with a mild, refreshing taste. Rich in antioxidants and vitamin C.' },
    { name: 'Ripe Bananas',        category: 'fruits',     price: 1.49, stock: 100, unit: 'bunch', retailer: retailerB._id, farmer: 'Tropical Fruits Co Simulation', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&q=80', description: 'Naturally ripened yellow bananas. Energy-packed and perfect for breakfast or smoothies.' },

    // PREMIER PROTEINS — meat + dairy
    // Top seller, running low
    { name: 'Free Range Chicken',  category: 'meat',       price: 8.99, stock: 12,  unit: 'kg',    retailer: retailerC._id, farmer: 'Premier Proteins Simulation', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&q=80', description: 'Premium free-range chicken breast, hormone-free. Lean, tender and perfect for any preparation.', featured: true },
    { name: 'Grass-Fed Beef Mince',category: 'meat',       price: 12.99, stock: 28, unit: 'kg',    retailer: retailerC._id, farmer: 'Premier Proteins Simulation', image: 'https://images.unsplash.com/photo-1588347818481-05b9c9e44370?w=500&q=80', description: 'Premium grass-fed ground beef, extra lean with rich natural flavour. No fillers.' },
    { name: 'Lamb Chops',          category: 'meat',       price: 15.99, stock: 20, unit: 'kg',    retailer: retailerC._id, farmer: 'Premier Proteins Simulation', image: 'https://images.unsplash.com/photo-1529693662653-9d480da3dc47?w=500&q=80', description: 'Tender succulent lamb chops from free-range pasture-raised sheep.', featured: true },
    // High volume dairy
    { name: 'Full Cream Milk',     category: 'dairy',      price: 3.99, stock: 90,  unit: 'litre', retailer: retailerC._id, farmer: 'Premier Proteins Simulation', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80', description: 'Fresh full cream milk from pasture-raised cows. Rich, creamy with no additives.', featured: true },
    { name: 'Greek Yogurt',        category: 'dairy',      price: 4.49, stock: 65,  unit: 'tub',   retailer: retailerC._id, farmer: 'Premier Proteins Simulation', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80', description: 'Thick creamy Greek-style yogurt packed with protein and live probiotic cultures.' },
    { name: 'Aged Cheddar Cheese', category: 'dairy',      price: 6.99, stock: 40,  unit: 'block', retailer: retailerC._id, farmer: 'Premier Proteins Simulation', image: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=500&q=80', description: 'Artisan-aged cheddar with a sharp complex flavour. Aged 12 months.' },
    // Grains
    { name: 'Basmati Rice',        category: 'grains',     price: 5.99, stock: 175, unit: 'kg',    retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1536304993881-ff86e0c9e14e?w=500&q=80', description: 'Premium extra-long grain basmati rice with a delicate floral aroma. Aged 2 years.' },
    { name: 'Whole Wheat Flour',   category: 'grains',     price: 3.49, stock: 130, unit: 'kg',    retailer: retailerA._id, farmer: 'Green Valley Farm Simulation', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&q=80', description: 'Stone-ground whole wheat flour retaining all bran and germ for maximum nutrition.' },
  ];

  const products = await Product.insertMany(productDefs);
  const byName = Object.fromEntries(products.map(p => [p.name, p]));
  console.log(`🛒  Created ${products.length} products`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDERS — 6 months of realistic demand patterns
  // ═══════════════════════════════════════════════════════════════════════════

  // Sales velocity config (units sold per order occurrence)
  // High number = popular product
  const salesConfig = {
    'Organic Tomatoes':    { freq: 18, qtyRange: [2, 5] },   // very high demand
    'Fresh Broccoli':      { freq: 12, qtyRange: [1, 3] },
    'Baby Spinach':        { freq: 14, qtyRange: [1, 3] },
    'Sweet Carrots':       { freq: 10, qtyRange: [2, 4] },
    'Purple Kale':         { freq: 2,  qtyRange: [1, 2] },   // slow mover
    'Alphonso Mangoes':    { freq: 20, qtyRange: [2, 4] },   // peak summer
    'Red Apples':          { freq: 15, qtyRange: [2, 5] },
    'Fresh Strawberries':  { freq: 13, qtyRange: [2, 4] },
    'Dragon Fruit':        { freq: 3,  qtyRange: [1, 2] },   // exotic, slow
    'Ripe Bananas':        { freq: 16, qtyRange: [2, 6] },
    'Free Range Chicken':  { freq: 17, qtyRange: [1, 3] },   // high demand
    'Grass-Fed Beef Mince':{ freq: 11, qtyRange: [1, 2] },
    'Lamb Chops':          { freq: 8,  qtyRange: [1, 2] },
    'Full Cream Milk':     { freq: 19, qtyRange: [2, 6] },   // staple, very high
    'Greek Yogurt':        { freq: 10, qtyRange: [1, 3] },
    'Aged Cheddar Cheese': { freq: 8,  qtyRange: [1, 2] },
    'Basmati Rice':        { freq: 9,  qtyRange: [2, 4] },
    'Whole Wheat Flour':   { freq: 7,  qtyRange: [2, 3] },
  };

  // Consumer preference profiles (which products each user tends to buy)
  const preferences = {
    0: ['Organic Tomatoes','Baby Spinach','Fresh Broccoli','Alphonso Mangoes'],    // Alice — health-conscious
    1: ['Grass-Fed Beef Mince','Free Range Chicken','Lamb Chops','Basmati Rice'], // Bob — meat lover
    2: ['Full Cream Milk','Greek Yogurt','Aged Cheddar Cheese','Fresh Strawberries'], // Carol — dairy/fruits
    3: ['Red Apples','Ripe Bananas','Fresh Strawberries','Alphonso Mangoes'],      // David — fruit lover
    4: ['Organic Tomatoes','Sweet Carrots','Baby Spinach','Whole Wheat Flour'],    // Emma — vegan
  };

  const orders = [];
  const allStatuses = ['delivered','delivered','delivered','delivered','processing','shipped'];

  for (let dayOffset = 180; dayOffset >= 1; dayOffset--) {
    const date = daysAgo(dayOffset);

    // Each day generate 1-4 orders
    const dailyOrders = rand(1, 4);
    for (let o = 0; o < dailyOrders; o++) {
      const consumerIdx = rand(0, consumers.length - 1);
      const consumer    = consumers[consumerIdx];
      const prefList    = preferences[consumerIdx];

      // Pick 1-4 items, weighted toward this consumer's preferences
      const numItems = rand(1, 4);
      const orderItems = [];
      const usedProducts = new Set();

      for (let i = 0; i < numItems; i++) {
        // 70% chance to pick from preference list, 30% random
        const productName = Math.random() < 0.7
          ? pick(prefList)
          : pick(Object.keys(salesConfig));

        if (usedProducts.has(productName)) continue;
        usedProducts.add(productName);

        const product = byName[productName];
        if (!product) continue;

        const cfg = salesConfig[productName];
        const quantity = rand(...cfg.qtyRange);

        orderItems.push({
          product:  product._id,
          retailer: product.retailer,
          name:     product.name,
          image:    product.image,
          price:    product.price,
          quantity,
          category: product.category,
        });
      }

      if (orderItems.length === 0) continue;

      const subtotal     = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const shippingPrice = subtotal > 50 ? 0 : 5.99;
      const tax          = subtotal * 0.08;
      const totalPrice   = subtotal + shippingPrice + tax;
      const loc          = pick(CITIES);
      const status       = dayOffset > 5 ? 'delivered' : pick(allStatuses);
      const driver       = pick(drivers);

      orders.push({
        user: consumer._id,
        items: orderItems,
        shippingAddress: { street: pick(STREETS), ...loc },
        deliveryPerson: status !== 'pending' ? driver._id : null,
        subtotal, shippingPrice, tax, totalPrice,
        status,
        isPaid: true,
        paidAt: date,
        isDelivered: status === 'delivered',
        deliveredAt: status === 'delivered' ? date : null,
        tip: status === 'delivered' ? (Math.random() < 0.6 ? rand(2, 15) : 0) : 0,
        createdAt: date,
        updatedAt: date,
      });
    }
  }

  // Add a few recent unassigned orders for the Route Optimizer demo
  const recentUnassigned = [0,1,2].map(i => {
    const consumer = consumers[i];
    const loc = CITIES[i];
    const items = [
      { product: byName['Organic Tomatoes']._id, retailer: retailerA._id, name: 'Organic Tomatoes', image: byName['Organic Tomatoes'].image, price: 3.49, quantity: 2, category: 'vegetables' },
      { product: byName['Free Range Chicken']._id, retailer: retailerC._id, name: 'Free Range Chicken', image: byName['Free Range Chicken'].image, price: 8.99, quantity: 1, category: 'meat' },
    ];
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    return {
      user: consumer._id, items,
      shippingAddress: { street: pick(STREETS), ...loc },
      deliveryPerson: drivers[0]._id,
      subtotal, shippingPrice: 0, tax: subtotal * 0.08, totalPrice: subtotal * 1.08,
      status: 'shipped', isPaid: true, paidAt: daysAgo(0),
      isDelivered: false, tip: 0,
      createdAt: daysAgo(0), updatedAt: daysAgo(0),
    };
  });
  orders.push(...recentUnassigned);

  const insertedOrders = await Order.insertMany(orders);
  console.log(`📦  Created ${insertedOrders.length} orders (6 months of history)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // REVIEWS — designed for interesting sentiment analysis
  // ═══════════════════════════════════════════════════════════════════════════
  const reviewData = [
    // Organic Tomatoes — glowing reviews
    { product: byName['Organic Tomatoes']._id, user: consumers[0]._id, rating: 5, comment: 'Absolutely the best tomatoes I have ever bought. So fresh and juicy, you can really taste the quality. Will keep ordering!' },
    { product: byName['Organic Tomatoes']._id, user: consumers[2]._id, rating: 5, comment: 'Perfect tomatoes every time. Arrived well-packaged and still firm. Great for salads and cooking.' },
    { product: byName['Organic Tomatoes']._id, user: consumers[4]._id, rating: 4, comment: 'Very tasty and fresh. Slightly smaller than expected but the flavour is excellent.' },

    // Free Range Chicken — mixed reviews with a recurring concern
    { product: byName['Free Range Chicken']._id, user: consumers[1]._id, rating: 4, comment: 'Good quality chicken, very tender. However the packaging was slightly damaged on arrival. Taste was great though.' },
    { product: byName['Free Range Chicken']._id, user: consumers[3]._id, rating: 3, comment: 'Chicken itself is fine but the packaging keeps arriving crushed. This has happened twice now. Please fix the packaging.' },
    { product: byName['Free Range Chicken']._id, user: consumers[2]._id, rating: 5, comment: 'Excellent free-range chicken. You can really taste the difference from supermarket chicken. Will buy again.' },

    // Alphonso Mangoes — seasonal favourite
    { product: byName['Alphonso Mangoes']._id, user: consumers[3]._id, rating: 5, comment: 'Oh wow. These are the real deal — perfectly ripe, incredibly sweet. Best mangoes outside of India!' },
    { product: byName['Alphonso Mangoes']._id, user: consumers[0]._id, rating: 5, comment: 'Arrived perfectly ripe and so fragrant. Finished the whole box in one day. Ordering more immediately.' },

    // Dragon Fruit — lukewarm
    { product: byName['Dragon Fruit']._id, user: consumers[4]._id, rating: 3, comment: 'Looks beautiful but the taste is quite bland. Expected something more exotic. Nice for Instagram but not much flavour.' },
    { product: byName['Dragon Fruit']._id, user: consumers[1]._id, rating: 2, comment: 'Very disappointing. The fruit was not ripe and had no flavour at all. Expensive for what it is.' },

    // Full Cream Milk — trusted staple
    { product: byName['Full Cream Milk']._id, user: consumers[2]._id, rating: 5, comment: 'Best milk I have ever had. Tastes so fresh and creamy. My kids love it. We subscribe to weekly delivery now.' },
    { product: byName['Full Cream Milk']._id, user: consumers[0]._id, rating: 4, comment: 'Really good quality milk. Noticeably fresher than what you get in supermarkets. Delivery is reliable.' },

    // Aged Cheddar — specialist interest
    { product: byName['Aged Cheddar Cheese']._id, user: consumers[2]._id, rating: 5, comment: 'This cheddar is outstanding. Sharp, complex and absolutely delicious. Goes perfectly with crackers and a glass of red.' },
    { product: byName['Aged Cheddar Cheese']._id, user: consumers[1]._id, rating: 4, comment: 'Great flavour but the portion felt a bit small for the price. Still, the quality is undeniable.' },

    // Baby Spinach
    { product: byName['Baby Spinach']._id, user: consumers[4]._id, rating: 5, comment: 'So fresh and crisp. Way better than bagged spinach from the store. Perfect for my morning smoothies.' },
    { product: byName['Baby Spinach']._id, user: consumers[0]._id, rating: 4, comment: 'Very fresh leaves, minimal wilting. Great for salads. Would appreciate slightly larger bags.' },

    // Lamb Chops
    { product: byName['Lamb Chops']._id, user: consumers[1]._id, rating: 5, comment: 'Incredible quality. These chops were tender, well-marbled and had that amazing grass-fed flavour. Restaurant quality.' },
  ];

  await Review.insertMany(reviewData);
  console.log(`⭐  Created ${reviewData.length} product reviews`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS — realistic customer issues
  // ═══════════════════════════════════════════════════════════════════════════
  const recentOrderIds = insertedOrders.slice(-20).map(o => o._id);

  await SupportTicket.insertMany([
    {
      user: consumers[0]._id, userName: consumers[0].name, userEmail: consumers[0].email, userRole: 'consumer',
      subject: 'Order has not arrived after 3 days',
      message: 'Hi, I placed an order 3 days ago (order total $42.50) and it still shows as "processing". I need these vegetables for a family dinner this weekend. Can you please check what is happening?',
      category: 'delivery', priority: 'medium', status: 'open',
      orderId: recentOrderIds[0]?.toString(),
      createdAt: daysAgo(1),
    },
    {
      user: consumers[1]._id, userName: consumers[1].name, userEmail: consumers[1].email, userRole: 'consumer',
      subject: 'I was charged twice for the same order',
      message: 'I see two identical charges of $67.99 on my credit card from HarvestHub dated yesterday. I only placed one order. Please refund the duplicate charge as soon as possible.',
      category: 'payment', priority: 'high', status: 'in_progress',
      responses: [{ message: 'Hi Bob, I can see the duplicate charge. We have raised this with our payment processor and you should see the refund within 3-5 business days. Apologies for the inconvenience.', from: 'admin', createdAt: daysAgo(0) }],
      createdAt: daysAgo(2),
    },
    {
      user: consumers[2]._id, userName: consumers[2].name, userEmail: consumers[2].email, userRole: 'consumer',
      subject: 'Chicken arrived in damaged packaging',
      message: 'My order of free-range chicken arrived today but the packaging was completely crushed and the cold pack had melted. I am worried about food safety. This is the second time this has happened.',
      category: 'product', priority: 'high', status: 'open',
      orderId: recentOrderIds[1]?.toString(),
      createdAt: daysAgo(0),
    },
    {
      user: consumers[3]._id, userName: consumers[3].name, userEmail: consumers[3].email, userRole: 'consumer',
      subject: 'Can I change delivery address for upcoming order?',
      message: 'I have an order being delivered tomorrow but I need to change the delivery address to my office instead of home. Is this possible?',
      category: 'order', priority: 'medium', status: 'resolved',
      adminNotes: 'Contacted delivery driver directly. Address updated successfully.',
      resolvedAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    {
      user: consumers[4]._id, userName: consumers[4].name, userEmail: consumers[4].email, userRole: 'consumer',
      subject: 'App keeps logging me out',
      message: 'Every time I close the browser and come back to HarvestHub I have to log in again. This is really annoying. Is there a way to stay logged in?',
      category: 'technical', priority: 'low', status: 'open',
      createdAt: daysAgo(3),
    },
  ]);
  console.log('🎫  Created 5 support tickets');

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(44));
  console.log('✅  Simulation dataset ready!\n');
  console.log('🔑  LOGIN CREDENTIALS (password: HarvestHub@123)');
  console.log('─'.repeat(44));
  console.log('RETAILERS:');
  console.log('  green@sim.harvesthub.com     → Green Valley Farm (vegetables/grains)');
  console.log('  tropical@sim.harvesthub.com  → Tropical Fruits Co (fruits)');
  console.log('  premier@sim.harvesthub.com   → Premier Proteins (meat/dairy)');
  console.log('\nCONSUMERS:');
  console.log('  alice@sim.harvesthub.com     → Health-conscious buyer');
  console.log('  bob@sim.harvesthub.com       → Meat lover');
  console.log('  carol@sim.harvesthub.com     → Dairy & fruit fan');
  console.log('  david@sim.harvesthub.com     → Fruit lover');
  console.log('  emma@sim.harvesthub.com      → Vegan shopper');
  console.log('\nDELIVERY DRIVERS:');
  console.log('  eddie@sim.harvesthub.com     → Active driver (use for Route Optimizer)');
  console.log('  sarah@sim.harvesthub.com     → Available driver');
  console.log('  mike@sim.harvesthub.com      → Available driver');
  console.log('─'.repeat(44));
  console.log('\n🤖  AI FEATURES TO TEST:');
  console.log('  Inventory AI   → Login as green@ or tropical@  (check restock tab)');
  console.log('  Pricing Engine → Tomatoes/Chicken = urgent ↑  Dragon Fruit/Kale = discount ↓');
  console.log('  Sentiment      → Chicken packaging issue will surface · Dragon Fruit negative');
  console.log('  Route Optimizer→ Login as eddie@, open AI Tools → 3 active deliveries ready');
  console.log('  Earnings Tips  → Eddie has 6mo delivery history with varied tips');
  console.log('  Recommendations→ Login as alice@, open shop (health products expected)');
  console.log('  Chatbot        → Login as bob@, ask "where is my order?"');
  console.log('  Recipes        → Login as any consumer, add Tomatoes + Mince to cart');
  console.log('═'.repeat(44) + '\n');

  mongoose.disconnect();
}
