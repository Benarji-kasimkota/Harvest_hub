const router = require('express').Router();
const {
  getAssignedOrders, getAvailableOrders, acceptOrder,
  updateDeliveryStatus, getDashboard, toggleAvailability,
  submitSupportTicket
} = require('../controllers/deliveryController');
const { protect, delivery } = require('../middleware/auth');
const { validators } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');

const acceptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many accept requests, please slow down' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.use(protect, delivery);
router.get('/dashboard', getDashboard);
router.get('/assigned', getAssignedOrders);
router.get('/available', getAvailableOrders);
router.put('/orders/:id/accept', acceptLimiter, acceptOrder);
router.put('/orders/:id/status', validators.updateDeliveryStatus, updateDeliveryStatus);
router.put('/toggle-availability', toggleAvailability);
router.post('/support', submitSupportTicket);

module.exports = router;
