const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getFeatured, getReviews, addReview, deleteReview
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/auth');
const { validators } = require('../middleware/validate');

// Stricter rate limit for product write operations
const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many write requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', getProducts);
router.get('/featured', getFeatured);
router.get('/:id', getProduct);
router.post('/', protect, admin, writeLimit, validators.createProduct, createProduct);
router.put('/:id', protect, admin, writeLimit, validators.updateProduct, updateProduct);
router.delete('/:id', protect, admin, writeLimit, deleteProduct);

router.get('/:id/reviews', getReviews);
router.post('/:id/reviews', protect, validators.addReview, addReview);
router.delete('/:id/reviews/:reviewId', protect, deleteReview);

module.exports = router;
