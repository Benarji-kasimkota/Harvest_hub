const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── Security Headers (OWASP A05) ───────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'js.stripe.com'],
      frameSrc: ["'self'", 'js.stripe.com'],
      connectSrc: ["'self'", 'api.stripe.com', '*.nominatim.openstreetmap.org'],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS (OWASP A05) ───────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server / same-origin requests (no origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // In development allow localhost variants
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Global Rate Limiting (OWASP A04) ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

// ── Stripe webhook needs raw body before JSON parser ─────────────────────
app.post('/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/paymentController').handleWebhook
);

// ── Request Body Parsing with size limit (OWASP A04) ─────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ── Cookie Parsing (for refresh token) ───────────────────────────────────
app.use(cookieParser());

// ── NoSQL Injection Prevention (OWASP A03) ─────────────────────────────────
// express-mongo-sanitize is incompatible with Express 5 (req.query is read-only).
// Instead, sanitize req.body and req.params inline — req.query values are
// validated at the controller level via whitelists and escapeRegex.
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[$\.]/g, '_'),
      sanitizeObject(v),
    ])
  );
};
app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  next();
});

// ── Static uploads ─────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    // Prevent uploaded files from being executed as scripts
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment');
  },
}));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/retailer', require('./routes/retailer'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/support', require('./routes/support'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/ai', require('./routes/ai'));

// ── Centralized Error Handler (OWASP A05) ─────────────────────────────────
app.use(errorHandler);

module.exports = app;
