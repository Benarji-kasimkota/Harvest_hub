const isProd = process.env.NODE_ENV === 'production';

// Centralized error handler — never leaks stack traces in production
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // Log full error server-side always
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  // Only expose message details in development
  const message = isProd && status === 500
    ? 'An unexpected error occurred'
    : err.message || 'An unexpected error occurred';

  res.status(status).json({ message });
};

// Wrap async route handlers so thrown errors reach the error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
