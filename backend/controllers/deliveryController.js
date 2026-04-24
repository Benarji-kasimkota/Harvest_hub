const Order = require('../models/Order');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');

exports.getAssignedOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ deliveryPerson: req.user.id })
      .populate('user', 'name email phone address')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};

exports.getAvailableOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ status: 'processing', deliveryPerson: null })
      .populate('user', 'name address')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};

exports.acceptOrder = async (req, res, next) => {
  try {
    // Only accept orders that are unassigned and in 'processing' state
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: 'processing', deliveryPerson: null },
      { deliveryPerson: req.user.id, status: 'shipped' },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not available for pickup' });
    res.json(order);
  } catch (err) { next(err); }
};

exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status, tip } = req.body;

    // IDOR fix: delivery person may only update orders assigned to them
    const order = await Order.findOne({ _id: req.params.id, deliveryPerson: req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found or not assigned to you' });

    const ALLOWED_TRANSITIONS = {
      shipped: ['out_for_delivery'],
      out_for_delivery: ['delivered'],
    };
    if (!ALLOWED_TRANSITIONS[order.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from '${order.status}' to '${status}'` });
    }

    order.status = status;
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      if (tip != null) order.tip = parseFloat(tip);
    }
    const updated = await order.save();
    res.json(updated);
  } catch (err) { next(err); }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const allOrders = await Order.find({ deliveryPerson: req.user.id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const delivered = allOrders.filter(o => o.status === 'delivered');
    const active = allOrders.filter(o => ['shipped', 'out_for_delivery'].includes(o.status));

    const basePayPerDelivery = 5.00;
    const totalBasePay = delivered.length * basePayPerDelivery;
    const totalTips = delivered.reduce((sum, o) => sum + (o.tip || 0), 0);
    const totalEarnings = totalBasePay + totalTips;

    const monthlyStats = {};
    delivered.forEach(o => {
      const month = new Date(o.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!monthlyStats[month]) monthlyStats[month] = { deliveries: 0, earnings: 0, tips: 0 };
      monthlyStats[month].deliveries++;
      monthlyStats[month].earnings += basePayPerDelivery + (o.tip || 0);
      monthlyStats[month].tips += (o.tip || 0);
    });

    res.json({
      totalDeliveries: delivered.length,
      activeDeliveries: active.length,
      totalEarnings,
      totalBasePay,
      totalTips,
      monthlyStats,
      recentDeliveries: delivered.slice(0, 5),
      allOrders: allOrders.slice(0, 10)
    });
  } catch (err) { next(err); }
};

exports.toggleAvailability = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.isAvailable = !user.isAvailable;
    await user.save();
    res.json({ isAvailable: user.isAvailable });
  } catch (err) { next(err); }
};

exports.submitSupportTicket = async (req, res, next) => {
  try {
    const { subject, message, orderId } = req.body;
    const ticket = await SupportTicket.create({
      user: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      subject,
      message,
      category: 'delivery',
      orderId,
      priority: 'medium',
    });
    res.status(201).json({ message: 'Support ticket submitted! Our team will respond within 24 hours.', ticketId: ticket._id.toString().slice(-6).toUpperCase() });
  } catch (err) { next(err); }
};
