process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');

let mongoServer;
let adminToken;
let consumerToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Order.deleteMany({});

  const hash = await bcrypt.hash('Password123', 12);
  await User.create({ name: 'Admin', email: 'admin@test.com', password: hash, role: 'admin', status: 'active' });

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'Password123' });
  adminToken = adminRes.body.token;

  const consumerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Consumer', email: 'consumer@test.com', password: 'Password123' });
  consumerToken = consumerRes.body.token;
});

// ── Access control ─────────────────────────────────────────────────────────
describe('Admin route access control', () => {
  it('blocks unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('blocks consumer role with 403', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Dashboard ──────────────────────────────────────────────────────────────
describe('GET /api/admin/dashboard', () => {
  it('returns stats with expected fields', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('totalOrders');
    expect(res.body).toHaveProperty('totalProducts');
    expect(res.body).toHaveProperty('pendingRetailers');
    expect(res.body).toHaveProperty('revenue');
  });
});

// ── List Users ─────────────────────────────────────────────────────────────
describe('GET /api/admin/users', () => {
  it('returns all users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('filters users by role', async () => {
    const res = await request(app)
      .get('/api/admin/users?role=admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every(u => u.role === 'admin')).toBe(true);
  });

  it('filters users by status', async () => {
    const hash = await bcrypt.hash('pass', 12);
    await User.create({ name: 'Pending R', email: 'pr@test.com', password: hash, role: 'retailer', status: 'pending' });
    const res = await request(app)
      .get('/api/admin/users?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every(u => u.status === 'pending')).toBe(true);
  });

  it('does not expose password field', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.every(u => !u.password)).toBe(true);
  });
});

// ── Create User ────────────────────────────────────────────────────────────
describe('POST /api/admin/users', () => {
  it('creates a new user with specified role', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Delivery Guy', email: 'delivery@test.com', password: 'Pass123!', role: 'delivery' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('delivery');
    expect(res.body.status).toBe('active');
    expect(res.body.password).toBeUndefined();
  });

  it('uses default password when none provided', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No Pass', email: 'nopass@test.com', role: 'consumer' });
    expect(res.status).toBe(201);
  });

  it('returns 400 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: 'admin@test.com', password: 'Pass123!' });
    expect(res.status).toBe(400);
  });
});

// ── Update User Status ─────────────────────────────────────────────────────
describe('PUT /api/admin/users/:id', () => {
  it('approves a pending retailer (status → active)', async () => {
    const hash = await bcrypt.hash('pass', 12);
    const retailer = await User.create({
      name: 'Pending R', email: 'ret@test.com', password: hash, role: 'retailer', status: 'pending'
    });
    const res = await request(app)
      .put(`/api/admin/users/${retailer._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('suspends an active user', async () => {
    const hash = await bcrypt.hash('pass', 12);
    const user = await User.create({
      name: 'Active', email: 'act@test.com', password: hash, role: 'consumer', status: 'active'
    });
    const res = await request(app)
      .put(`/api/admin/users/${user._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
  });

  it('changes a user\'s role', async () => {
    const hash = await bcrypt.hash('pass', 12);
    const user = await User.create({
      name: 'Promo', email: 'promo@test.com', password: hash, role: 'consumer', status: 'active'
    });
    const res = await request(app)
      .put(`/api/admin/users/${user._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'delivery' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('delivery');
  });

  it('returns 404 for non-existent user ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/admin/users/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(404);
  });
});

// ── Delete User ────────────────────────────────────────────────────────────
describe('DELETE /api/admin/users/:id', () => {
  it('deletes a user and confirms removal', async () => {
    const hash = await bcrypt.hash('pass', 12);
    const user = await User.create({
      name: 'Gone', email: 'gone@test.com', password: hash, role: 'consumer', status: 'active'
    });
    const res = await request(app)
      .delete(`/api/admin/users/${user._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const gone = await User.findById(user._id);
    expect(gone).toBeNull();
  });
});

// ── Orders ─────────────────────────────────────────────────────────────────
describe('GET /api/admin/orders', () => {
  it('returns all orders', async () => {
    const user = await User.findOne({ role: 'admin' });
    await Order.create({
      user: user._id,
      items: [{ name: 'Apple', price: 1.99, quantity: 2 }],
      shippingAddress: { street: '1 Main', city: 'NY', state: 'NY', zipCode: '10001', country: 'US' },
      subtotal: 3.98,
      totalPrice: 3.98,
    });
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });
});

describe('PUT /api/admin/orders/:id/status', () => {
  it('updates an order status', async () => {
    const user = await User.findOne({ role: 'admin' });
    const order = await Order.create({
      user: user._id,
      items: [{ name: 'Apple', price: 1.99, quantity: 1 }],
      shippingAddress: { street: '1 Main', city: 'NY', state: 'NY', zipCode: '10001', country: 'US' },
      subtotal: 1.99,
      totalPrice: 1.99,
    });
    const res = await request(app)
      .put(`/api/admin/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
  });

  it('rejects invalid order status with 400', async () => {
    const user = await User.findOne({ role: 'admin' });
    const order = await Order.create({
      user: user._id,
      items: [{ name: 'Apple', price: 1.99, quantity: 1 }],
      shippingAddress: { street: '1 Main', city: 'NY', state: 'NY', zipCode: '10001', country: 'US' },
      subtotal: 1.99, totalPrice: 1.99,
    });
    const res = await request(app)
      .put(`/api/admin/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'flying' });
    expect(res.status).toBe(400);
  });
});

// ── Product Management ─────────────────────────────────────────────────────
const Product = require('../models/Product');

const productData = {
  name: 'Red Apple',
  price: 1.99,
  category: 'fruits',
  stock: 50,
  description: 'Sweet apples',
  image: 'https://example.com/apple.jpg',
  unit: 'kg',
};

describe('GET /api/admin/products', () => {
  it('returns all products across all retailers', async () => {
    const retailerA = await User.create({
      name: 'RetA', email: 'reta@test.com',
      password: await require('bcryptjs').hash('pass', 12),
      role: 'retailer', status: 'active',
    });
    const retailerB = await User.create({
      name: 'RetB', email: 'retb@test.com',
      password: await require('bcryptjs').hash('pass', 12),
      role: 'retailer', status: 'active',
    });
    await Product.create({ ...productData, retailer: retailerA._id });
    await Product.create({ ...productData, name: 'Banana', retailer: retailerB._id });

    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('filters products by category', async () => {
    const retailer = await User.create({
      name: 'RetC', email: 'retc@test.com',
      password: await require('bcryptjs').hash('pass', 12),
      role: 'retailer', status: 'active',
    });
    await Product.create({ ...productData, category: 'fruits', retailer: retailer._id });
    await Product.create({ ...productData, name: 'Carrot', category: 'vegetables', retailer: retailer._id });

    const res = await request(app)
      .get('/api/admin/products?category=vegetables')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every(p => p.category === 'vegetables')).toBe(true);
  });

  it('blocks consumer role with 403', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/products/:id', () => {
  it("admin can delete any retailer's product", async () => {
    const retailer = await User.create({
      name: 'RetD', email: 'retd@test.com',
      password: await require('bcryptjs').hash('pass', 12),
      role: 'retailer', status: 'active',
    });
    const product = await Product.create({ ...productData, retailer: retailer._id });

    const res = await request(app)
      .delete(`/api/admin/products/${product._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const gone = await Product.findById(product._id);
    expect(gone).toBeNull();
  });

  it('returns 404 for non-existent product', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/admin/products/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── Delivery Oversight ─────────────────────────────────────────────────────
describe('GET /api/admin/delivery', () => {
  it('returns drivers, assigned orders, and unassigned orders', async () => {
    const bcrypt = require('bcryptjs');
    const driver = await User.create({
      name: 'Driver Dan', email: 'dan@test.com',
      password: await bcrypt.hash('pass', 12),
      role: 'delivery', status: 'active',
    });
    const consumer = await User.findOne({ role: 'consumer' });
    const userId = consumer?._id || new mongoose.Types.ObjectId();

    await Order.create({
      user: userId,
      items: [{ name: 'Mango', price: 2, quantity: 1 }],
      shippingAddress: { street: '1 Oak', city: 'LA', state: 'CA', zipCode: '90001', country: 'US' },
      subtotal: 2, totalPrice: 2,
      status: 'shipped', deliveryPerson: driver._id,
    });
    await Order.create({
      user: userId,
      items: [{ name: 'Pear', price: 1, quantity: 1 }],
      shippingAddress: { street: '2 Oak', city: 'LA', state: 'CA', zipCode: '90001', country: 'US' },
      subtotal: 1, totalPrice: 1,
      status: 'processing', deliveryPerson: null,
    });

    const res = await request(app)
      .get('/api/admin/delivery')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('drivers');
    expect(res.body).toHaveProperty('assignedOrders');
    expect(res.body).toHaveProperty('unassignedOrders');
    expect(res.body.drivers.length).toBeGreaterThanOrEqual(1);
    expect(res.body.unassignedOrders.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PUT /api/admin/orders/:id/reassign', () => {
  it('reassigns an order to a specific delivery driver', async () => {
    const bcrypt = require('bcryptjs');
    const driver = await User.create({
      name: 'New Driver', email: 'newdriver@test.com',
      password: await bcrypt.hash('pass', 12),
      role: 'delivery', status: 'active',
    });
    const consumer = await User.findOne({ role: 'consumer' });
    const order = await Order.create({
      user: consumer._id,
      items: [{ name: 'Peach', price: 2.5, quantity: 1 }],
      shippingAddress: { street: '3 Oak', city: 'SF', state: 'CA', zipCode: '94102', country: 'US' },
      subtotal: 2.5, totalPrice: 2.5, status: 'processing',
    });

    const res = await request(app)
      .put(`/api/admin/orders/${order._id}/reassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deliveryPersonId: driver._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.deliveryPerson._id.toString()).toBe(driver._id.toString());
    expect(res.body.status).toBe('shipped');
  });

  it('returns 404 when delivery person ID does not exist', async () => {
    const consumer = await User.findOne({ role: 'consumer' });
    const order = await Order.create({
      user: consumer._id,
      items: [{ name: 'Plum', price: 1.5, quantity: 1 }],
      shippingAddress: { street: '4 Oak', city: 'SF', state: 'CA', zipCode: '94102', country: 'US' },
      subtotal: 1.5, totalPrice: 1.5, status: 'processing',
    });
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/admin/orders/${order._id}/reassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deliveryPersonId: fakeId.toString() });
    expect(res.status).toBe(404);
  });
});

// ── Retailer Analytics ─────────────────────────────────────────────────────
describe('GET /api/admin/analytics', () => {
  it('returns analytics array sorted by revenue descending', async () => {
    const bcrypt = require('bcryptjs');
    const r1 = await User.create({
      name: 'TopRet', email: 'topret@test.com',
      password: await bcrypt.hash('pass', 12),
      role: 'retailer', status: 'active',
    });
    const r2 = await User.create({
      name: 'LowRet', email: 'lowret@test.com',
      password: await bcrypt.hash('pass', 12),
      role: 'retailer', status: 'active',
    });
    const p1 = await Product.create({ ...productData, retailer: r1._id });
    const p2 = await Product.create({ ...productData, name: 'Grape', retailer: r2._id });
    const consumer = await User.findOne({ role: 'consumer' });

    await Order.create({
      user: consumer._id,
      items: [{ name: 'Red Apple', price: 10, quantity: 5, product: p1._id }],
      shippingAddress: { street: '5 Oak', city: 'NY', state: 'NY', zipCode: '10001', country: 'US' },
      subtotal: 50, totalPrice: 50, isPaid: true,
    });
    await Order.create({
      user: consumer._id,
      items: [{ name: 'Grape', price: 2, quantity: 1, product: p2._id }],
      shippingAddress: { street: '6 Oak', city: 'NY', state: 'NY', zipCode: '10001', country: 'US' },
      subtotal: 2, totalPrice: 2, isPaid: true,
    });

    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('revenue');
    expect(res.body[0]).toHaveProperty('retailer');
    expect(res.body[0]).toHaveProperty('productCount');
    if (res.body.length >= 2) {
      expect(res.body[0].revenue).toBeGreaterThanOrEqual(res.body[1].revenue);
    }
  });
});
