const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { register, login, refresh, logoutUser, getProfile, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validators } = require('../middleware/validate');

// Strict rate limit for auth endpoints (OWASP A04 — brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  message: { message: 'Too many attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts
});

router.post('/register', authLimiter, validators.register, register);
router.post('/login', authLimiter, validators.login, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, validators.updateProfile, updateProfile);
router.put('/change-password', protect, validators.changePassword, changePassword);

module.exports = router;
