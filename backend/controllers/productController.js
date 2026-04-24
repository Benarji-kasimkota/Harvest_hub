const Product = require('../models/Product');
const Review = require('../models/Review');
const { escapeRegex, VALID_CATEGORIES } = require('../middleware/validate');

// Whitelist of fields an admin may set on a product (prevents mass assignment)
const ADMIN_PRODUCT_FIELDS = ['name', 'description', 'price', 'category', 'image', 'stock', 'unit', 'farmer', 'featured', 'retailer'];
const pickFields = (obj, allowed) =>
  allowed.reduce((acc, k) => { if (k in obj) acc[k] = obj[k]; return acc; }, {});

exports.getProducts = async (req, res, next) => {
  try {
    const { category, search, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const query = {};

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });
      query.category = category;
    }
    if (search) {
      // Escape to prevent ReDoS (OWASP A03)
      const safe = escapeRegex(String(search).slice(0, 100));
      query.name = { $regex: safe, $options: 'i' };
    }

    const sortMap = { price_asc: { price: 1 }, price_desc: { price: -1 } };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const total = await Product.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const products = await Product.find(query)
      .sort({ ...sortObj, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ products, total, page, pages });
  } catch (err) { next(err); }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    // Whitelist fields — prevents mass assignment (OWASP A08)
    const data = pickFields(req.body, ADMIN_PRODUCT_FIELDS);
    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const data = pickFields(req.body, ADMIN_PRODUCT_FIELDS);
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
};

exports.getFeatured = async (req, res, next) => {
  try {
    const products = await Product.find({ featured: true }).limit(8);
    res.json(products);
  } catch (err) { next(err); }
};

exports.getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.id }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) { next(err); }
};

exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const existing = await Review.findOne({ product: req.params.id, user: req.user.id });
    if (existing) return res.status(400).json({ message: 'You have already reviewed this product' });

    const review = await Review.create({
      product: req.params.id,
      user: req.user.id,
      userName: req.user.name,
      rating: Number(rating),
      comment: comment.trim(),
    });

    const allReviews = await Review.find({ product: req.params.id });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Product.findByIdAndUpdate(req.params.id, {
      rating: Math.round(avgRating * 10) / 10,
      numReviews: allReviews.length,
    });

    res.status(201).json(review);
  } catch (err) { next(err); }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const isOwner = review.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

    await Review.findByIdAndDelete(req.params.reviewId);

    const allReviews = await Review.find({ product: req.params.id });
    const avgRating = allReviews.length
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;
    await Product.findByIdAndUpdate(req.params.id, {
      rating: Math.round(avgRating * 10) / 10,
      numReviews: allReviews.length,
    });

    res.json({ message: 'Review deleted' });
  } catch (err) { next(err); }
};
