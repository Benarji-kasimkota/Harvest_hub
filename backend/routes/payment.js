const router = require('express').Router();
const { createPaymentIntent } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
router.post('/create-payment-intent', protect, createPaymentIntent);
module.exports = router;
