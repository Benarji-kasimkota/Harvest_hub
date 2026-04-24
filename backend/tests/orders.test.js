process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const bcrypt = require('bcryptjs');

let mongoServer;
let consumerToken, consumerId;
let consumer2Token;
let adminToken;

const sampleOrder = () => ({
  items: [{ name: 'Tomatoes', image: 'tom.jpg', price: 2.99, quantity: 2 }],
  shippingAddress: { street: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701', country: 'USA' },
  subtotal: 5.98,
  shippingPrice: 0,
  tax: 0.48,
  totalPrice: 6.46,
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

let productId;

beforeEach(async () => {
  await User.deleteMany({});
  await Order.deleteMany({});
  await Product.deleteMany({});

  const prod = await Product.create({
    name: 'Tomatoes', description: 'Fresh tomatoes', price: 2.99,
    category: 'vegetables', image: 'https://example.com/tom.jpg', stock: 10, unit: 'kg', farmer: 'Test Farm',
  });
  productId = prod._id.toString();

  const hash = await bcrypt.hash('Password123', 12);
  await User.create({ name: 'Admin', email: 'admin@test.com', password: hash, role: 'admin', status: 'active' });

  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123' });
  adminToken = adminRes.body.token;

  const c1 = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@test.com', password: 'Password123' });
  consumerToken = c1.body.token;
  consumerId = c1.body._id;

  const c2 = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: 'Password123' });
  consumer2Token = c2.body.token;
});

// ── Create Order ───────────────────────────────────────────────────────────
describe('POST /api/orders', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/orders').send(sampleOrder());
    expect(res.status).toBe(401);
  });

  it('creates an order and returns 201', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(sampleOrder());
    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.isPaid).toBe(false);
  });

  it('assigns the order to the authenticated user', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(sampleOrder());
    expect(res.body.user).toBe(consumerId);
  });

  it('stores items and totals correctly', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(sampleOrder());
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Tomatoes');
    expect(res.body.totalPrice).toBe(6.46);
    expect(res.body.subtotal).toBe(5.98);
  });
});

// ── Get My Orders ──────────────────────────────────────────────────────────
describe('GET /api/orders/myorders', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/orders/myorders');
    expect(res.status).toBe(401);
  });

  it('returns only the current user\'s orders', async () => {
    await request(app).post('/api/orders').set('Authorization', `Bearer ${consumerToken}`).send(sampleOrder());
    await request(app).post('/api/orders').set('Authorization', `Bearer ${consumer2Token}`).send(sampleOrder());

    const res = await request(app).get('/api/orders/myorders').set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].user).toBe(consumerId);
  });

  it('returns empty array when user has no orders', async () => {
    const res = await request(app).get('/api/orders/myorders').set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns orders sorted newest first', async () => {
    const o1 = await request(app).post('/api/orders').set('Authorization', `Bearer ${consumerToken}`).send(sampleOrder());
    const o2 = await request(app).post('/api/orders').set('Authorization', `Bearer ${consumerToken}`).send({ ...sampleOrder(), totalPrice: 9.99 });

    const res = await request(app).get('/api/orders/myorders').set('Authorization', `Bearer ${consumerToken}`);
    expect(res.body[0]._id).toBe(o2.body._id);
  });
});

// ── Get Order by ID ────────────────────────────────────────────────────────
describe('GET /api/orders/:id', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(sampleOrder());
    orderId = res.body._id;
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`);
    expect(res.status).toBe(401);
  });

  it('returns order details for the owner', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(orderId);
  });

  it('allows admin to view any order', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('blocks a different consumer from viewing someone else\'s order with 403', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${consumer2Token}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent order ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/orders/${fakeId}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(404);
  });
});

// ── Cancel Order ───────────────────────────────────────────────────────────
describe('PUT /api/orders/:id/cancel', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(sampleOrder());
    orderId = res.body._id;
  });

  it('requires authentication', async () => {
    const res = await request(app).put(`/api/orders/${orderId}/cancel`);
    expect(res.status).toBe(401);
  });

  it('cancels a pending order and sets status to cancelled', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('cancels a processing order', async () => {
    await Order.findByIdAndUpdate(orderId, { status: 'processing' });
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('blocks cancelling a shipped order with 400', async () => {
    await Order.findByIdAndUpdate(orderId, { status: 'shipped' });
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/shipped/i);
  });

  it('blocks cancelling an out_for_delivery order with 400', async () => {
    await Order.findByIdAndUpdate(orderId, { status: 'out_for_delivery' });
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(400);
  });

  it('blocks cancelling a delivered order with 400', async () => {
    await Order.findByIdAndUpdate(orderId, { status: 'delivered', isDelivered: true });
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(400);
  });

  it('blocks cancelling an already-cancelled order with 400', async () => {
    await request(app).put(`/api/orders/${orderId}/cancel`).set('Authorization', `Bearer ${consumerToken}`);
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already cancelled/i);
  });

  it('blocks a different user from cancelling someone else\'s order with 403', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumer2Token}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to cancel any order', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('returns 404 for a non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/orders/${fakeId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(404);
  });
});

// ── Mark Order as Paid ─────────────────────────────────────────────────────
describe('PUT /api/orders/:id/pay', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(sampleOrder());
    orderId = res.body._id;
  });

  it('requires authentication', async () => {
    const res = await request(app).put(`/api/orders/${orderId}/pay`).send({ id: 'pi_xxx', status: 'succeeded' });
    expect(res.status).toBe(401);
  });

  it('marks order as paid and changes status to processing', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ id: 'pi_test123', status: 'succeeded', email: 'alice@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.isPaid).toBe(true);
    expect(res.body.status).toBe('processing');
    expect(res.body.paidAt).toBeDefined();
  });

  it('stores the payment result', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ id: 'pi_abc', status: 'succeeded', email: 'alice@test.com' });
    expect(res.body.paymentResult.id).toBe('pi_abc');
    expect(res.body.paymentResult.status).toBe('succeeded');
  });

  it('returns 404 for a non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/orders/${fakeId}/pay`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ id: 'pi_xxx' });
    expect(res.status).toBe(404);
  });

  it('stores the paymentIntentId on the order', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ id: 'pi_stored123', status: 'succeeded' });
    expect(res.status).toBe(200);
    expect(res.body.paymentIntentId).toBe('pi_stored123');
  });

  it('returns 400 when trying to pay an already-paid order', async () => {
    await request(app)
      .put(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ id: 'pi_first', status: 'succeeded' });

    const res = await request(app)
      .put(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ id: 'pi_second', status: 'succeeded' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already paid/i);
  });

  it('blocks a different user from marking someone else\'s order as paid', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ id: 'pi_hack', status: 'succeeded' });
    expect(res.status).toBe(403);
  });
});

// ── Inventory: Stock Check on Order Create ─────────────────────────────────
describe('POST /api/orders — inventory enforcement', () => {
  const orderWithProduct = (qty) => ({
    items: [{ product: null, name: 'Tomatoes', image: 'tom.jpg', price: 2.99, quantity: qty }],
    shippingAddress: { street: '123 Main', city: 'Austin', state: 'TX', zipCode: '78701', country: 'USA' },
    subtotal: 2.99 * qty,
    shippingPrice: 0,
    tax: 0.24,
    totalPrice: 2.99 * qty + 0.24,
  });

  it('decrements product stock after a successful order', async () => {
    const payload = orderWithProduct(3);
    payload.items[0].product = productId;

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(payload);

    const prod = await Product.findById(productId);
    expect(prod.stock).toBe(7); // started at 10, ordered 3
  });

  it('rejects order when quantity exceeds available stock with 409', async () => {
    const payload = orderWithProduct(20); // only 10 in stock
    payload.items[0].product = productId;

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/stock|available/i);
  });

  it('does not decrement stock when order is rejected', async () => {
    const payload = orderWithProduct(20);
    payload.items[0].product = productId;

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(payload);

    const prod = await Product.findById(productId);
    expect(prod.stock).toBe(10); // unchanged
  });

  it('allows ordering exactly the remaining stock', async () => {
    const payload = orderWithProduct(10);
    payload.items[0].product = productId;

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    const prod = await Product.findById(productId);
    expect(prod.stock).toBe(0);
  });
});

// ── Inventory: Stock Restored on Cancellation ──────────────────────────────
describe('PUT /api/orders/:id/cancel — stock restoration', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({
        items: [{ product: productId, name: 'Tomatoes', image: 'tom.jpg', price: 2.99, quantity: 4 }],
        shippingAddress: { street: '123 Main', city: 'Austin', state: 'TX', zipCode: '78701', country: 'USA' },
        subtotal: 11.96,
        shippingPrice: 0,
        tax: 0.96,
        totalPrice: 12.92,
      });
    orderId = res.body._id;
  });

  it('restores stock when a pending order is cancelled', async () => {
    const before = await Product.findById(productId);
    expect(before.stock).toBe(6); // 10 - 4

    await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${consumerToken}`);

    const after = await Product.findById(productId);
    expect(after.stock).toBe(10); // restored
  });

  it('restores stock when admin cancels a processing order', async () => {
    await Order.findByIdAndUpdate(orderId, { status: 'processing' });

    await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    const prod = await Product.findById(productId);
    expect(prod.stock).toBe(10);
  });
});
