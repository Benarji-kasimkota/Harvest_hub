const Product = require('../models/Product');
const Order = require('../models/Order');

// Fields a retailer may set on their own product (prevents mass assignment / rating manipulation)
const RETAILER_PRODUCT_FIELDS = ['name', 'description', 'price', 'category', 'image', 'stock', 'unit'];
const pickFields = (obj, allowed) =>
  allowed.reduce((acc, k) => { if (k in obj) acc[k] = obj[k]; return acc; }, {});

exports.getMyProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ retailer: req.user.id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { next(err); }
};

exports.addProduct = async (req, res, next) => {
  try {
    const data = pickFields(req.body, RETAILER_PRODUCT_FIELDS);
    data.retailer = req.user.id;
    data.farmer = req.user.storeName || req.user.name;
    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== 'admin') filter.retailer = req.user.id;
    const product = await Product.findOne(filter);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const data = pickFields(req.body, RETAILER_PRODUCT_FIELDS);
    const updated = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== 'admin') filter.retailer = req.user.id;
    const product = await Product.findOneAndDelete(filter);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const myProducts = await Product.find({ retailer: req.user.id });
    const productIds = myProducts.map(p => p._id);
    const productCount = myProducts.length;
    const lowStock = myProducts.filter(p => p.stock < 10).length;

    const orders = await Order.find({
      'items.product': { $in: productIds },
      isPaid: true
    }).populate('user', 'name email').sort({ createdAt: -1 });

    let totalRevenue = 0;
    let totalItemsSold = 0;
    const productRevenue = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (productIds.some(id => id.toString() === item.product?.toString())) {
          const itemRevenue = item.price * item.quantity;
          totalRevenue += itemRevenue;
          totalItemsSold += item.quantity;
          const key = item.product.toString();
          if (!productRevenue[key]) {
            productRevenue[key] = { name: item.name, revenue: 0, sold: 0 };
          }
          productRevenue[key].revenue += itemRevenue;
          productRevenue[key].sold += item.quantity;
        }
      });
    });

    const monthlyRevenue = {};
    orders.forEach(order => {
      const month = new Date(order.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!monthlyRevenue[month]) monthlyRevenue[month] = 0;
      order.items.forEach(item => {
        if (productIds.some(id => id.toString() === item.product?.toString())) {
          monthlyRevenue[month] += item.price * item.quantity;
        }
      });
    });

    res.json({
      productCount,
      lowStock,
      totalRevenue,
      totalItemsSold,
      totalOrders: orders.length,
      topProducts: Object.values(productRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      monthlyRevenue,
      recentOrders: orders.slice(0, 5).map(o => ({
        id: o._id,
        customer: o.user?.name,
        date: o.createdAt,
        items: o.items.filter(i => productIds.some(id => id.toString() === i.product?.toString())),
        status: o.status
      }))
    });
  } catch (err) { next(err); }
};
