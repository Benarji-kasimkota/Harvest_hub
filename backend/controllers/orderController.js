const Order = require('../models/Order');
const Product = require('../models/Product');
const { verifyPaymentIntent } = require('./paymentController');

exports.createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, subtotal, shippingPrice, tax, totalPrice } = req.body;

    // Check and atomically decrement stock for each item
    const decremented = [];
    try {
      for (const item of items) {
        if (!item.product) continue;
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
        if (!updated) {
          // Restore any already-decremented stock
          for (const done of decremented) {
            await Product.findByIdAndUpdate(done.id, { $inc: { stock: done.qty } });
          }
          const prod = await Product.findById(item.product).select('name stock');
          const msg = prod
            ? `"${prod.name}" only has ${prod.stock} in stock (requested ${item.quantity})`
            : 'A product is out of stock';
          return res.status(409).json({ message: msg });
        }
        decremented.push({ id: item.product, qty: item.quantity });
      }
    } catch (stockErr) {
      for (const done of decremented) {
        await Product.findByIdAndUpdate(done.id, { $inc: { stock: done.qty } }).catch(() => {});
      }
      throw stockErr;
    }

    const order = await Order.create({
      user: req.user.id,
      items,
      shippingAddress,
      subtotal,
      shippingPrice,
      tax,
      totalPrice
    });
    res.status(201).json(order);
  } catch (err) { next(err); }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(order);
  } catch (err) { next(err); }
};

exports.updateOrderToPaid = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (order.isPaid) {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    const { id, status, update_time, payer } = req.body;
    const piId = String(id || '').slice(0, 100);

    // Verify payment with Stripe when configured
    if (piId.startsWith('pi_')) {
      const verified = await verifyPaymentIntent(piId);
      if (!verified) return res.status(400).json({ message: 'Payment not confirmed by Stripe' });
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.status = 'processing';
    order.paymentIntentId = piId;
    order.paymentResult = {
      id: piId,
      status: String(status || '').slice(0, 50),
      update_time: String(update_time || '').slice(0, 50),
      email_address: String(payer?.email_address || '').slice(0, 254)
    };

    const updated = await order.save();
    res.json(updated);
  } catch (err) { next(err); }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (['shipped', 'out_for_delivery', 'delivered'].includes(order.status)) {
      return res.status(400).json({ message: 'Cannot cancel an order that has already shipped' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    order.status = 'cancelled';
    await order.save();

    // Restore stock for cancelled orders
    for (const item of order.items) {
      if (item.product && item.quantity) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }).catch(() => {});
      }
    }

    res.json(order);
  } catch (err) { next(err); }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({}).populate('user', 'name email').sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};
