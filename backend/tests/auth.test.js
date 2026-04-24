process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

// ── Register ───────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a consumer and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'Password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('consumer');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 400 when email already exists', async () => {
    await User.create({
      name: 'Existing', email: 'dup@test.com',
      password: 'hash', role: 'consumer', status: 'active'
    });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'dup@test.com', password: 'Password123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  });

  it('creates retailer with pending status and no token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@test.com', password: 'Password123', role: 'retailer' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/admin approval/i);
    expect(res.body.token).toBeUndefined();
    const user = await User.findOne({ email: 'bob@test.com' });
    expect(user.status).toBe('pending');
  });
});

// ── Login ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const hash = await bcrypt.hash('Password123', 12);
    await User.insertMany([
      { name: 'Active', email: 'active@test.com', password: hash, role: 'consumer', status: 'active' },
      { name: 'Pending', email: 'pending@test.com', password: hash, role: 'retailer', status: 'pending' },
      { name: 'Suspended', email: 'sus@test.com', password: hash, role: 'consumer', status: 'suspended' },
    ]);
  });

  it('returns token for valid active user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'active@test.com', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.email).toBe('active@test.com');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'active@test.com', password: 'WrongPass99' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
  });

  it('blocks pending retailer with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pending@test.com', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/pending/i);
  });

  it('blocks suspended user with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sus@test.com', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/i);
  });
});

// ── Profile ────────────────────────────────────────────────────────────────
describe('GET /api/auth/profile', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Carol', email: 'carol@test.com', password: 'Password123' });
    token = res.body.token;
  });

  it('returns profile for authenticated user (no password field)', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('carol@test.com');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

// ── Update Profile ─────────────────────────────────────────────────────────
describe('PUT /api/auth/profile', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dave', email: 'dave@test.com', password: 'Password123' });
    token = res.body.token;
  });

  it('updates name and phone', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dave Updated', phone: '555-0000' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Dave Updated');
    expect(res.body.phone).toBe('555-0000');
  });
});

// ── Change Password ────────────────────────────────────────────────────────
describe('PUT /api/auth/change-password', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@test.com', password: 'OldPass123' });
    token = res.body.token;
  });

  it('changes password with correct current password', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass123', newPassword: 'NewPass456' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  it('rejects incorrect current password with 400', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass99', newPassword: 'NewPass456' });
    expect(res.status).toBe(400);
  });
});

// ── Token type — access token is 1h, refresh token rejected as access ──────
describe('JWT token type enforcement', () => {
  let loginRes;

  beforeEach(async () => {
    const hash = await bcrypt.hash('Password123', 12);
    await User.create({ name: 'Frank', email: 'frank@test.com', password: hash, role: 'consumer', status: 'active' });
    loginRes = await request(app).post('/api/auth/login').send({ email: 'frank@test.com', password: 'Password123' });
  });

  it('login returns a short-lived access token (type:access in payload)', () => {
    const token = loginRes.body.token;
    expect(token).toBeDefined();
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    expect(payload.type).toBe('access');
  });

  it('access token works for protected routes', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a refresh token used as an access token with 401', async () => {
    // Manually forge a refresh-type token signed with the same secret
    const jwt = require('jsonwebtoken');
    const refreshToken = jwt.sign({ id: 'someid', type: 'refresh' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${refreshToken}`);
    expect(res.status).toBe(401);
  });
});

// ── Refresh Token ──────────────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh token cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no refresh token/i);
  });

  it('returns a new access token when a valid refresh cookie is sent', async () => {
    const hash = await bcrypt.hash('Password123', 12);
    await User.create({ name: 'Grace', email: 'grace@test.com', password: hash, role: 'consumer', status: 'active' });

    // Login to get the refresh token cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'grace@test.com', password: 'Password123' });
    const cookie = loginRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    // Use the cookie to refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.email).toBe('grace@test.com');
  });

  it('issues a new access token that works for protected routes', async () => {
    const hash = await bcrypt.hash('Password123', 12);
    await User.create({ name: 'Hank', email: 'hank@test.com', password: hash, role: 'consumer', status: 'active' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hank@test.com', password: 'Password123' });
    const cookie = loginRes.headers['set-cookie'];

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    const newToken = refreshRes.body.token;

    const profileRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${newToken}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.email).toBe('hank@test.com');
  });

  it('returns 401 for a tampered refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=tampered.invalid.token; Path=/api/auth');
    expect(res.status).toBe(401);
  });
});

// ── Logout ─────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('clears the refresh token and returns 200', async () => {
    const hash = await bcrypt.hash('Password123', 12);
    await User.create({ name: 'Ivan', email: 'ivan@test.com', password: hash, role: 'consumer', status: 'active' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ivan@test.com', password: 'Password123' });
    const token = loginRes.body.token;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });

  it('invalidates the refresh token after logout', async () => {
    const hash = await bcrypt.hash('Password123', 12);
    await User.create({ name: 'Julia', email: 'julia@test.com', password: hash, role: 'consumer', status: 'active' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'julia@test.com', password: 'Password123' });
    const token = loginRes.body.token;
    const cookie = loginRes.headers['set-cookie'];

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    // Attempt to use the old refresh token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});
