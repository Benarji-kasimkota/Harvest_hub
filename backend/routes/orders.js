const router = require('express').Router();
const { createOrder, getMyOrders, getOrder, updateOrderToPaid, cancelOrder, getAllOrders } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/auth');
const { validators } = require('../middleware/validate');

router.post('/', protect, validators.createOrder, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/', protect, admin, getAllOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/pay', protect, updateOrderToPaid);
router.put('/:id/cancel', protect, cancelOrder);

module.exports = router;
