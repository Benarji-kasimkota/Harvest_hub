const router = require('express').Router();
const { createOrder, getMyOrders, getOrder, updateOrderToPaid, getAllOrders } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/auth');
router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/', protect, admin, getAllOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/pay', protect, updateOrderToPaid);
module.exports = router;
