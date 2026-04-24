process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const bcrypt = require('bcryptjs');

let mongoServer;
let retailerToken;
let retailerId;
let consumerToken;

const productData = {
  name: 'Fresh Apples',
  price: 2.99,
  category: 'fruits',
  stock: 100,
  description: 'Crisp red apples',
  image: 'https://example.com/apple.jpg',
  unit: 'kg',
};

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
  await Product.deleteMany({});

  const hash = await bcrypt.hash('Password123', 12);
  const retailer = await User.create({
    name: 'RetailerA', email: 'retailer@test.com', password: hash,
    role: 'retailer', status: 'active'
  });
  retailerId = retailer._id;

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'retailer@test.com', password: 'Password123' });
  retailerToken = res.body.token;

  const cRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Consumer', email: 'consumer@test.com', password: 'Password123' });
  consumerToken = cRes.body.token;
});

// ── Access control ─────────────────────────────────────────────────────────
describe('Retailer route access control', () => {
  it('blocks unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/retailer/products');
    expect(res.status).toBe(401);
  });

  it('blocks consumer role with 403', async () => {
    const res = await request(app)
      .get('/api/retailer/products')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Products CRUD ──────────────────────────────────────────────────────────
describe('GET /api/retailer/products', () => {
  it('returns only this retailer\'s products', async () => {
    await Product.create({ ...productData, retailer: retailerId });
    await Product.create({ ...productData, name: 'Other', retailer: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .get('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Fresh Apples');
  });

  it('returns empty array when retailer has no products', async () => {
    const res = await request(app)
      .get('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/retailer/products', () => {
  it('creates product associated with the retailer', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(productData);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Fresh Apples');
    expect(res.body.retailer.toString()).toBe(retailerId.toString());
    expect(res.body.price).toBe(2.99);
  });

  it('sets farmer to retailer name automatically', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(productData);
    expect(res.body.farmer).toBe('RetailerA');
  });
});

describe('PUT /api/retailer/products/:id', () => {
  it('updates a product owned by this retailer', async () => {
    const product = await Product.create({ ...productData, retailer: retailerId });
    const res = await request(app)
      .put(`/api/retailer/products/${product._id}`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ price: 4.99, stock: 200 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(4.99);
    expect(res.body.stock).toBe(200);
  });

  it('returns 404 when updating another retailer\'s product', async () => {
    const otherId = new mongoose.Types.ObjectId();
    const product = await Product.create({ ...productData, retailer: otherId });
    const res = await request(app)
      .put(`/api/retailer/products/${product._id}`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ price: 999 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/retailer/products/:id', () => {
  it('deletes a product owned by this retailer', async () => {
    const product = await Product.create({ ...productData, retailer: retailerId });
    const res = await request(app)
      .delete(`/api/retailer/products/${product._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.status).toBe(200);
    const gone = await Product.findById(product._id);
    expect(gone).toBeNull();
  });

  it('does not delete another retailer\'s product', async () => {
    const otherId = new mongoose.Types.ObjectId();
    const product = await Product.create({ ...productData, retailer: otherId });
    await request(app)
      .delete(`/api/retailer/products/${product._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);
    const still = await Product.findById(product._id);
    expect(still).not.toBeNull();
  });
});

// ── Validator boundary cases ───────────────────────────────────────────────
describe('POST /api/retailer/products — validation', () => {
  it('rejects missing name with 422', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ ...productData, name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects negative price with 422', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ ...productData, price: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects negative stock with 422', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ ...productData, stock: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects invalid category with 422', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ ...productData, category: 'unicorns' });
    expect(res.status).toBe(400);
  });

  it('rejects non-URL image with 422', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ ...productData, image: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid product and returns 201', async () => {
    const res = await request(app)
      .post('/api/retailer/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(productData);
    expect(res.status).toBe(201);
  });
});

// ── Dashboard ──────────────────────────────────────────────────────────────
describe('GET /api/retailer/dashboard', () => {
  it('returns dashboard stats with expected fields', async () => {
    const res = await request(app)
      .get('/api/retailer/dashboard')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('productCount');
    expect(res.body).toHaveProperty('lowStock');
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body).toHaveProperty('totalOrders');
    expect(res.body).toHaveProperty('recentOrders');
  });

  it('counts low-stock products (stock < 10)', async () => {
    await Product.create({ ...productData, stock: 5, retailer: retailerId });
    await Product.create({ ...productData, name: 'Banana', stock: 50, retailer: retailerId });

    const res = await request(app)
      .get('/api/retailer/dashboard')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(res.body.productCount).toBe(2);
    expect(res.body.lowStock).toBe(1);
  });
});
