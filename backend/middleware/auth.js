const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized — no token' });
    }
    const token = authHeader.split(' ')[1].trim();
    if (!token) return res.status(401).json({ message: 'Not authorized — no token' });

    // Explicitly specify algorithm to prevent algorithm confusion attacks (OWASP A07)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    // Reject refresh tokens used as access tokens
    if (decoded.type === 'refresh') return res.status(401).json({ message: 'Invalid token type' });
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Not authorized — user not found' });
    if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token' });
    res.status(401).json({ message: 'Not authorized' });
  }
};

exports.admin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ message: 'Admin access required' });
};

exports.retailer = (req, res, next) => {
  if (req.user?.role === 'retailer' || req.user?.role === 'admin') return next();
  res.status(403).json({ message: 'Retailer access required' });
};

exports.delivery = (req, res, next) => {
  if (req.user?.role === 'delivery' || req.user?.role === 'admin') return next();
  res.status(403).json({ message: 'Delivery access required' });
};
