const router = require('express').Router();
const {
  getDashboard, getUsers, createUser, updateUserStatus,
  deleteUser, getAllOrders, updateOrderStatus,
  getAllProducts, adminDeleteProduct,
  getDeliveryOverview, reassignOrder,
  getRetailerAnalytics,
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');
const { validators } = require('../middleware/validate');

router.use(protect, admin);
router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.post('/users', validators.createUser, createUser);
router.put('/users/:id', validators.updateUserStatus, updateUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', validators.updateOrderStatus, updateOrderStatus);
router.put('/orders/:id/reassign', reassignOrder);
router.get('/products', getAllProducts);
router.delete('/products/:id', adminDeleteProduct);
router.get('/delivery', getDeliveryOverview);
router.get('/analytics', getRetailerAnalytics);

module.exports = router;
