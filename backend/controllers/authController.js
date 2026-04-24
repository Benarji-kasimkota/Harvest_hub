const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id) =>
  jwt.sign({ id, type: 'access' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h'
  });

const generateRefreshToken = (id) =>
  jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d'
  });

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

const SELF_REGISTER_ROLES = ['consumer', 'retailer'];

const issueTokens = async (user, res) => {
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  await User.findByIdAndUpdate(user._id, { refreshToken: hashToken(refreshToken) });
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE);
  return token;
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const safeRole = SELF_REGISTER_ROLES.includes(role) ? role : 'consumer';
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const status = safeRole === 'retailer' ? 'pending' : 'active';
    const user = await User.create({ name, email, password: hashedPassword, role: safeRole, status });
    if (safeRole === 'retailer') {
      return res.status(201).json({ message: 'Retailer account created! Awaiting admin approval.' });
    }
    const token = await issueTokens(user, res);
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, status: user.status, token
    });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.status === 'pending') return res.status(403).json({ message: 'Your account is pending admin approval.' });
    if (user.status === 'suspended') return res.status(403).json({ message: 'Your account has been suspended.' });
    const token = await issueTokens(user, res);
    res.json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, status: user.status, token
    });
  } catch (err) { next(err); }
};

exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      return res.status(401).json({ message: 'Refresh token expired or invalid' });
    }
    if (decoded.type !== 'refresh') return res.status(401).json({ message: 'Invalid token type' });

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== hashToken(refreshToken)) {
      return res.status(401).json({ message: 'Refresh token revoked' });
    }
    if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended' });

    const newToken = await issueTokens(user, res);
    res.json({
      token: newToken,
      _id: user._id, name: user.name, email: user.email,
      role: user.role, status: user.status,
    });
  } catch (err) { next(err); }
};

exports.logoutUser = async (req, res) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    }
  } catch (err) {
    console.error('Logout token cleanup failed:', err.message);
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out' });
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name: req.body.name, phone: req.body.phone, address: req.body.address },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(req.body.newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) { next(err); }
};
