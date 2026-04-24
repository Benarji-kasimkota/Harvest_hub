const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const bcrypt = require('bcryptjs');

const VALID_ROLES = ['consumer', 'retailer', 'delivery', 'admin'];
const VALID_USER_STATUSES = ['active', 'pending', 'suspended'];
const VALID_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

exports.getDashboard = async (req, res, next) => {
  try {
    const [totalUsers, totalOrders, totalProducts, pendingRetailers, recentOrders] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments(),
      User.countDocuments({ role: 'retailer', status: 'pending' }),
      Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email')
    ]);
    const revenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const revenueByMonth = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: {
        _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
        total: { $sum: '$totalPrice' },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);
    res.json({
      totalUsers, totalOrders, totalProducts, pendingRetailers,
      revenue: revenue[0]?.total || 0,
      revenueByMonth,
      recentOrders
    });
  } catch (err) { next(err); }
};

exports.getUsers = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.role) {
      if (!VALID_ROLES.includes(req.query.role)) return res.status(400).json({ message: 'Invalid role filter' });
      query.role = req.query.role;
    }
    if (req.query.status) {
      if (!VALID_USER_STATUSES.includes(req.query.status)) return res.status(400).json({ message: 'Invalid status filter' });
      query.status = req.query.status;
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(
      password || process.env.DEFAULT_USER_PASSWORD || 'HarvestHub@123', 12
    );
    const user = await User.create({
      name, email, phone,
      password: hashedPassword,
      role: role || 'consumer',
      status: 'active'
    });
    const { password: _pw, ...userOut } = user.toObject();
    res.status(201).json(userOut);
  } catch (err) { next(err); }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status, role } = req.body;
    if (status && !VALID_USER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role value' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...(status && { status }), ...(role && { role }) },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
};

// ── Product Management ────────────────────────────────────────────────────────
exports.getAllProducts = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.retailer) query.retailer = req.query.retailer;
    const products = await Product.find(query)
      .populate('retailer', 'name email')
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { next(err); }
};

exports.adminDeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted by admin' });
  } catch (err) { next(err); }
};

// ── Delivery Oversight ────────────────────────────────────────────────────────
exports.getDeliveryOverview = async (req, res, next) => {
  try {
    const drivers = await User.find({ role: 'delivery' }).select('-password');
    const driverIds = drivers.map(d => d._id);

    const [assignedOrders, unassignedOrders] = await Promise.all([
      Order.find({ deliveryPerson: { $in: driverIds }, status: { $in: ['shipped', 'out_for_delivery'] } })
        .populate('user', 'name').populate('deliveryPerson', 'name'),
      Order.find({ status: 'processing', deliveryPerson: null })
        .populate('user', 'name').sort({ createdAt: 1 }),
    ]);

    const driverStats = await Promise.all(drivers.map(async (d) => {
      const delivered = await Order.countDocuments({ deliveryPerson: d._id, status: 'delivered' });
      const active = await Order.countDocuments({ deliveryPerson: d._id, status: { $in: ['shipped', 'out_for_delivery'] } });
      return { ...d.toObject(), deliveredCount: delivered, activeCount: active };
    }));

    res.json({ drivers: driverStats, assignedOrders, unassignedOrders });
  } catch (err) { next(err); }
};

exports.reassignOrder = async (req, res, next) => {
  try {
    const { deliveryPersonId } = req.body;
    if (!deliveryPersonId) return res.status(400).json({ message: 'deliveryPersonId is required' });

    const driver = await User.findOne({ _id: deliveryPersonId, role: 'delivery' });
    if (!driver) return res.status(404).json({ message: 'Delivery person not found' });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { deliveryPerson: deliveryPersonId, status: 'shipped' },
      { new: true }
    ).populate('deliveryPerson', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
};

// ── Retailer Analytics ────────────────────────────────────────────────────────
exports.getRetailerAnalytics = async (req, res, next) => {
  try {
    const retailers = await User.find({ role: 'retailer' }).select('-password');

    const analytics = await Promise.all(retailers.map(async (r) => {
      const products = await Product.find({ retailer: r._id });
      const productIds = products.map(p => p._id);

      const orders = await Order.find({ 'items.product': { $in: productIds }, isPaid: true });
      let revenue = 0, itemsSold = 0;
      orders.forEach(o => o.items.forEach(item => {
        if (productIds.some(id => id.toString() === item.product?.toString())) {
          revenue += item.price * item.quantity;
          itemsSold += item.quantity;
        }
      }));

      return {
        retailer: { id: r._id, name: r.name, email: r.email, status: r.status, joinedAt: r.createdAt },
        productCount: products.length,
        lowStockCount: products.filter(p => p.stock < 10).length,
        orderCount: orders.length,
        revenue,
        itemsSold,
      };
    }));

    analytics.sort((a, b) => b.revenue - a.revenue);
    res.json(analytics);
  } catch (err) { next(err); }
};
