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
let deliveryToken;
let deliveryId;
let consumerToken;

const makeOrder = (overrides = {}) =>
  Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ name: 'Mango', price: 3.00, quantity: 2 }],
    shippingAddress: { street: '10 Oak', city: 'Springfield', state: 'IL', zipCode: '62701', country: 'US' },
    subtotal: 6.00,
    totalPrice: 6.00,
    status: 'processing',
    isPaid: true,
    deliveryPerson: null,
    ...overrides,
  });

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
  const delivery = await User.create({
    name: 'Driver Dan', email: 'driver@test.com', password: hash,
    role: 'delivery', status: 'active', isAvailable: true,
  });
  deliveryId = delivery._id;

  const dRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'driver@test.com', password: 'Password123' });
  deliveryToken = dRes.body.token;

  const cRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Consumer', email: 'consumer@test.com', password: 'Password123' });
  consumerToken = cRes.body.token;
});

// ── Access control ─────────────────────────────────────────────────────────
describe('Delivery route access control', () => {
  it('blocks unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/delivery/available');
    expect(res.status).toBe(401);
  });

  it('blocks consumer role with 403', async () => {
    const res = await request(app)
      .get('/api/delivery/available')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Available Orders ───────────────────────────────────────────────────────
describe('GET /api/delivery/available', () => {
  it('returns processing orders with no delivery person assigned', async () => {
    await makeOrder();
    await makeOrder({ status: 'delivered' });
    await makeOrder({ deliveryPerson: deliveryId });

    const res = await request(app)
      .get('/api/delivery/available')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('returns empty array when no orders are available', async () => {
    const res = await request(app)
      .get('/api/delivery/available')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── Accept Order ───────────────────────────────────────────────────────────
describe('PUT /api/delivery/orders/:id/accept', () => {
  it('assigns delivery person and sets status to shipped', async () => {
    const order = await makeOrder();
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/accept`)
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.deliveryPerson.toString()).toBe(deliveryId.toString());
    expect(res.body.status).toBe('shipped');
  });
});

// ── Assigned Orders ────────────────────────────────────────────────────────
describe('GET /api/delivery/assigned', () => {
  it('returns only orders assigned to this delivery person', async () => {
    await makeOrder({ deliveryPerson: deliveryId, status: 'shipped' });
    await makeOrder({ deliveryPerson: new mongoose.Types.ObjectId(), status: 'shipped' });
    await makeOrder();

    const res = await request(app)
      .get('/api/delivery/assigned')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

// ── Update Delivery Status ─────────────────────────────────────────────────
describe('PUT /api/delivery/orders/:id/status', () => {
  it('marks order as delivered with isDelivered flag and deliveredAt date', async () => {
    const order = await makeOrder({ deliveryPerson: deliveryId, status: 'out_for_delivery' });
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
    expect(res.body.isDelivered).toBe(true);
    expect(res.body.deliveredAt).toBeDefined();
  });

  it('records tip amount when marking as delivered', async () => {
    const order = await makeOrder({ deliveryPerson: deliveryId, status: 'out_for_delivery' });
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'delivered', tip: 4.5 });
    expect(res.status).toBe(200);
    expect(res.body.tip).toBe(4.5);
  });

  it('can update status to out_for_delivery without setting isDelivered', async () => {
    const order = await makeOrder({ deliveryPerson: deliveryId, status: 'shipped' });
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'out_for_delivery' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('out_for_delivery');
    expect(res.body.isDelivered).toBe(false);
  });
});

// ── Dashboard ──────────────────────────────────────────────────────────────
describe('GET /api/delivery/dashboard', () => {
  it('returns dashboard with expected stats fields', async () => {
    const res = await request(app)
      .get('/api/delivery/dashboard')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalDeliveries');
    expect(res.body).toHaveProperty('activeDeliveries');
    expect(res.body).toHaveProperty('totalEarnings');
    expect(res.body).toHaveProperty('totalTips');
    expect(res.body).toHaveProperty('recentDeliveries');
  });

  it('calculates earnings: $5 per delivery + tips', async () => {
    await makeOrder({ deliveryPerson: deliveryId, status: 'delivered', isDelivered: true, isPaid: true, tip: 2.0 });
    await makeOrder({ deliveryPerson: deliveryId, status: 'delivered', isDelivered: true, isPaid: true, tip: 3.0 });

    const res = await request(app)
      .get('/api/delivery/dashboard')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.body.totalDeliveries).toBe(2);
    expect(res.body.totalTips).toBe(5.0);
    expect(res.body.totalEarnings).toBe(10 + 5.0);
  });
});

// ── Status Transition Guard ────────────────────────────────────────────────
describe('Status transition guard', () => {
  it('blocks shipped → delivered (must go through out_for_delivery first)', async () => {
    const order = await makeOrder({ deliveryPerson: deliveryId, status: 'shipped' });
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(400);
  });

  it('blocks updating an order assigned to a different driver', async () => {
    const otherDriver = new mongoose.Types.ObjectId();
    const order = await makeOrder({ deliveryPerson: otherDriver, status: 'out_for_delivery' });
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'delivered' });
    expect([403, 404]).toContain(res.status);
  });

  it('blocks an invalid target status string', async () => {
    const order = await makeOrder({ deliveryPerson: deliveryId, status: 'shipped' });
    const res = await request(app)
      .put(`/api/delivery/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'teleported' });
    expect(res.status).toBe(400);
  });
});

// ── Toggle Availability ────────────────────────────────────────────────────
describe('PUT /api/delivery/toggle-availability', () => {
  it('toggles isAvailable from true to false', async () => {
    const res = await request(app)
      .put('/api/delivery/toggle-availability')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isAvailable).toBe(false);
  });

  it('toggles isAvailable back to true on second call', async () => {
    await request(app)
      .put('/api/delivery/toggle-availability')
      .set('Authorization', `Bearer ${deliveryToken}`);
    const res = await request(app)
      .put('/api/delivery/toggle-availability')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.body.isAvailable).toBe(true);
  });
});
