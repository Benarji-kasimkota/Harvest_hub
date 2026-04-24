const express = require('express');
const router = express.Router();
const { protect, retailer, delivery } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const {
  getInsights, applyRestock,
  getRecommendations, naturalLanguageSearch, getFreshnessAdvice,
  getRecipeSuggestions, chatSupport,
  getDynamicPricing, generateProductDescription, getReviewSentiment,
  optimizeRoute, getEarningsTips,
} = require('../controllers/aiController');

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => String(req.user?._id || req.user?.id || 'anon'),
  message: { message: 'Too many AI requests, please wait a few minutes' },
  skip: () => process.env.NODE_ENV === 'test',
});

// ── Retailer / Admin ──────────────────────────────────────────────────────────
router.get('/insights',             protect, retailer, aiLimiter, getInsights);
router.post('/restock',             protect, retailer, applyRestock);
router.get('/pricing',              protect, retailer, aiLimiter, getDynamicPricing);
router.post('/generate-description',protect, retailer, aiLimiter, generateProductDescription);
router.get('/sentiment',            protect, retailer, aiLimiter, getReviewSentiment);

// ── Customer (any authenticated user) ────────────────────────────────────────
router.post('/recommendations',     protect, aiLimiter, getRecommendations);
router.post('/search',              protect, aiLimiter, naturalLanguageSearch);
router.post('/freshness',           protect, aiLimiter, getFreshnessAdvice);
router.post('/recipes',             protect, aiLimiter, getRecipeSuggestions);
router.post('/chat',                protect, aiLimiter, chatSupport);

// ── Delivery ──────────────────────────────────────────────────────────────────
router.post('/route-optimize',      protect, delivery, aiLimiter, optimizeRoute);
router.get('/earnings-tips',        protect, delivery, aiLimiter, getEarningsTips);

module.exports = router;
