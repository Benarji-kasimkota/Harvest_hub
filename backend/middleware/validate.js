const { body, param, query, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

// Escape regex special chars to prevent ReDoS
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const VALID_CATEGORIES = ['vegetables', 'fruits', 'meat', 'dairy', 'grains'];
const VALID_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const VALID_USER_ROLES = ['consumer', 'retailer', 'delivery', 'admin'];
const VALID_USER_STATUSES = ['active', 'pending', 'suspended'];
const VALID_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_TICKET_CATEGORIES = ['general', 'order', 'payment', 'delivery', 'product', 'account', 'refund', 'technical'];

const validators = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name contains invalid characters'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required')
      .isLength({ max: 254 }).withMessage('Email too long'),
    body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
    body('role').optional()
      .isIn(['consumer', 'retailer', 'delivery']).withMessage('Invalid role'),
    handleValidation,
  ],

  login: [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required')
      .isLength({ max: 254 }).withMessage('Email too long'),
    body('password').notEmpty().withMessage('Password is required')
      .isLength({ max: 128 }).withMessage('Password too long'),
    handleValidation,
  ],

  updateProfile: [
    body('name').optional().trim()
      .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name contains invalid characters'),
    body('phone').optional().trim()
      .matches(/^[\d\s\-\+\(\)]{7,20}$/).withMessage('Invalid phone number'),
    body('address.street').optional().trim().isLength({ max: 200 }).withMessage('Street too long'),
    body('address.city').optional().trim().isLength({ max: 100 }).withMessage('City too long'),
    body('address.state').optional().trim().isLength({ max: 100 }).withMessage('State too long'),
    body('address.zipCode').optional().trim()
      .matches(/^[\d\w\s\-]{3,10}$/).withMessage('Invalid zip code'),
    body('address.country').optional().trim().isLength({ max: 100 }).withMessage('Country too long'),
    handleValidation,
  ],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8, max: 128 }).withMessage('New password must be 8–128 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
    handleValidation,
  ],

  // ── Products ──────────────────────────────────────────────────────────────
  createProduct: [
    body('name').trim().notEmpty().withMessage('Product name is required')
      .isLength({ min: 2, max: 200 }).withMessage('Name must be 2–200 characters'),
    body('description').trim().notEmpty().withMessage('Description is required')
      .isLength({ min: 10, max: 2000 }).withMessage('Description must be 10–2000 characters'),
    body('price').isFloat({ min: 0.01, max: 100000 }).withMessage('Price must be between 0.01 and 100,000'),
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('stock').isInt({ min: 0, max: 1000000 }).withMessage('Stock must be 0–1,000,000'),
    body('image').optional().trim().isURL({ require_protocol: true }).withMessage('Image must be a valid URL')
      .isLength({ max: 2000 }).withMessage('Image URL too long'),
    body('unit').optional().trim().isIn(['kg', 'lb', 'bunch', 'piece', 'litre', 'dozen', 'bag'])
      .withMessage('Invalid unit'),
    body('farmer').optional().trim().isLength({ max: 200 }).withMessage('Farmer name too long'),
    handleValidation,
  ],

  updateProduct: [
    body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Name must be 2–200 characters'),
    body('description').optional().trim().isLength({ min: 10, max: 2000 }).withMessage('Description too long'),
    body('price').optional().isFloat({ min: 0.01, max: 100000 }).withMessage('Invalid price'),
    body('category').optional().isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('stock').optional().isInt({ min: 0, max: 1000000 }).withMessage('Invalid stock'),
    body('image').optional().trim().isURL({ require_protocol: true }).withMessage('Image must be a valid URL')
      .isLength({ max: 2000 }),
    body('unit').optional().trim().isIn(['kg', 'lb', 'bunch', 'piece', 'litre', 'dozen', 'bag']),
    handleValidation,
  ],

  // ── Orders ────────────────────────────────────────────────────────────────
  createOrder: [
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.name').trim().notEmpty().withMessage('Item name required')
      .isLength({ max: 200 }).withMessage('Item name too long'),
    body('items.*.price').isFloat({ min: 0 }).withMessage('Item price must be non-negative'),
    body('items.*.quantity').isInt({ min: 1, max: 1000 }).withMessage('Item quantity must be 1–1000'),
    body('shippingAddress.street').trim().notEmpty().withMessage('Street address required')
      .isLength({ max: 200 }).withMessage('Street too long'),
    body('shippingAddress.city').trim().notEmpty().withMessage('City required')
      .isLength({ max: 100 }).withMessage('City too long'),
    body('shippingAddress.state').trim().notEmpty().withMessage('State required')
      .isLength({ max: 100 }).withMessage('State too long'),
    body('shippingAddress.zipCode').trim().notEmpty().withMessage('Zip code required')
      .matches(/^[\d\w\s\-]{3,10}$/).withMessage('Invalid zip code'),
    body('shippingAddress.country').trim().notEmpty().withMessage('Country required')
      .isLength({ max: 100 }).withMessage('Country too long'),
    body('subtotal').isFloat({ min: 0 }).withMessage('Invalid subtotal'),
    body('shippingPrice').isFloat({ min: 0 }).withMessage('Invalid shipping price'),
    body('tax').isFloat({ min: 0 }).withMessage('Invalid tax'),
    body('totalPrice').isFloat({ min: 0.01 }).withMessage('Total must be greater than 0'),
    handleValidation,
  ],

  // ── Reviews ───────────────────────────────────────────────────────────────
  addReview: [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5'),
    body('comment').trim().notEmpty().withMessage('Comment is required')
      .isLength({ min: 5, max: 1000 }).withMessage('Comment must be 5–1000 characters'),
    handleValidation,
  ],

  // ── Support ───────────────────────────────────────────────────────────────
  createTicket: [
    body('subject').trim().notEmpty().withMessage('Subject is required')
      .isLength({ min: 5, max: 200 }).withMessage('Subject must be 5–200 characters'),
    body('message').trim().notEmpty().withMessage('Message is required')
      .isLength({ min: 10, max: 5000 }).withMessage('Message must be 10–5000 characters'),
    body('category').optional().isIn(VALID_TICKET_CATEGORIES).withMessage('Invalid category'),
    handleValidation,
  ],

  updateTicket: [
    body('status').optional().isIn(VALID_TICKET_STATUSES).withMessage('Invalid status'),
    body('adminNotes').optional().trim().isLength({ max: 2000 }).withMessage('Admin notes too long'),
    body('response').optional().trim().isLength({ max: 5000 }).withMessage('Response too long'),
    handleValidation,
  ],

  // ── Admin ─────────────────────────────────────────────────────────────────
  createUser: [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').optional().isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters'),
    body('role').optional().isIn(VALID_USER_ROLES).withMessage('Invalid role'),
    body('phone').optional().trim().matches(/^[\d\s\-\+\(\)]{7,20}$/).withMessage('Invalid phone'),
    handleValidation,
  ],

  updateUserStatus: [
    body('status').optional().isIn(VALID_USER_STATUSES).withMessage('Invalid status'),
    body('role').optional().isIn(VALID_USER_ROLES).withMessage('Invalid role'),
    handleValidation,
  ],

  updateOrderStatus: [
    body('status').isIn(VALID_ORDER_STATUSES).withMessage('Invalid order status'),
    handleValidation,
  ],

  // ── Delivery ──────────────────────────────────────────────────────────────
  updateDeliveryStatus: [
    body('status').isIn(['shipped', 'out_for_delivery', 'delivered']).withMessage('Invalid delivery status'),
    body('tip').optional().isFloat({ min: 0, max: 500 }).withMessage('Tip must be 0–500'),
    handleValidation,
  ],
};

module.exports = { validators, escapeRegex, VALID_CATEGORIES, VALID_ORDER_STATUSES };
