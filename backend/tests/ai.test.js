// AI routes — auth guards and no-key (demo) mode
// These tests do NOT require a real Gemini key; they verify that:
//  1. Unauthenticated requests are rejected
//  2. Role-protected routes block the wrong role
//  3. When GEMINI_API_KEY is absent the API returns demo:true (503)

process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
// Explicitly unset the key so demo-mode is active for all tests
delete process.env.GEMINI_API_KEY;

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

let mongoServer;
let consumerToken;
let retailerToken;
let deliveryToken;

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

  const hash = await bcrypt.hash('Password123', 12);

  await User.create({ name: 'Retailer', email: 'retailer@ai.test', password: hash, role: 'retailer', status: 'active' });
  await User.create({ name: 'Driver', email: 'driver@ai.test', password: hash, role: 'delivery', status: 'active' });

  const [rRes, dRes, cRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'retailer@ai.test', password: 'Password123' }),
    request(app).post('/api/auth/login').send({ email: 'driver@ai.test', password: 'Password123' }),
    request(app).post('/api/auth/register').send({ name: 'Consumer', email: 'consumer@ai.test', password: 'Password123' }),
  ]);
  retailerToken = rRes.body.token;
  deliveryToken = dRes.body.token;
  consumerToken = cRes.body.token;
});

// ── Authentication guards ──────────────────────────────────────────────────
describe('AI route authentication guards', () => {
  const protectedRoutes = [
    ['GET',  '/api/ai/insights'],
    ['POST', '/api/ai/recommendations'],
    ['POST', '/api/ai/search'],
    ['POST', '/api/ai/freshness'],
    ['POST', '/api/ai/recipes'],
    ['POST', '/api/ai/chat'],
    ['GET',  '/api/ai/pricing'],
    ['POST', '/api/ai/route-optimize'],
    ['GET',  '/api/ai/earnings-tips'],
  ];

  for (const [method, path] of protectedRoutes) {
    it(`${method} ${path} returns 401 without token`, async () => {
      const res = await request(app)[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });
  }
});

// ── Role guards ────────────────────────────────────────────────────────────
describe('AI route role guards', () => {
  it('GET /api/ai/insights blocks consumer with 403', async () => {
    const res = await request(app)
      .get('/api/ai/insights')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/ai/pricing blocks consumer with 403', async () => {
    const res = await request(app)
      .get('/api/ai/pricing')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/ai/route-optimize blocks consumer with 403', async () => {
    const res = await request(app)
      .post('/api/ai/route-optimize')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ orderIds: [] });
    expect(res.status).toBe(403);
  });

  it('GET /api/ai/earnings-tips blocks consumer with 403', async () => {
    const res = await request(app)
      .get('/api/ai/earnings-tips')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/ai/route-optimize blocks retailer with 403', async () => {
    const res = await request(app)
      .post('/api/ai/route-optimize')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ orderIds: [] });
    expect(res.status).toBe(403);
  });

  it('GET /api/ai/insights blocks delivery driver with 403', async () => {
    const res = await request(app)
      .get('/api/ai/insights')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Demo mode (no GEMINI_API_KEY) ─────────────────────────────────────────
describe('AI demo mode — no GEMINI_API_KEY', () => {
  it('GET /api/ai/insights returns 503 with demo:true', async () => {
    const res = await request(app)
      .get('/api/ai/insights')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.status).toBe(503);
    expect(res.body.demo).toBe(true);
    expect(res.body.message).toMatch(/GEMINI_API_KEY/i);
  });

  it('GET /api/ai/pricing returns 503 with demo:true', async () => {
    const res = await request(app)
      .get('/api/ai/pricing')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.status).toBe(503);
    expect(res.body.demo).toBe(true);
  });

  it('POST /api/ai/recommendations returns 503 with demo:true', async () => {
    const res = await request(app)
      .post('/api/ai/recommendations')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.demo).toBe(true);
  });

  it('POST /api/ai/search returns 503 with demo:true', async () => {
    const res = await request(app)
      .post('/api/ai/search')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'fresh tomatoes' });
    expect(res.status).toBe(503);
    expect(res.body.demo).toBe(true);
  });

  it('POST /api/ai/chat returns 503 with demo:true', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ message: 'hello' });
    expect(res.status).toBe(503);
    expect(res.body.demo).toBe(true);
  });

  it('GET /api/ai/earnings-tips returns 503 with demo:true', async () => {
    const res = await request(app)
      .get('/api/ai/earnings-tips')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(503);
    expect(res.body.demo).toBe(true);
  });
});
