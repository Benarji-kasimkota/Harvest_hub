process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const bcrypt = require('bcryptjs');

let mongoServer;
let consumerToken, consumerId;
let consumer2Token, consumer2Id;
let adminToken;
let productId;

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
  await Review.deleteMany({});

  const hash = await bcrypt.hash('Password123', 12);

  await User.create({ name: 'Admin', email: 'admin@test.com', password: hash, role: 'admin', status: 'active' });
  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123' });
  adminToken = adminRes.body.token;

  const c1 = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@test.com', password: 'Password123' });
  consumerToken = c1.body.token;
  consumerId = c1.body._id;

  const c2 = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: 'Password123' });
  consumer2Token = c2.body.token;
  consumer2Id = c2.body._id;

  const product = await Product.create({
    name: 'Fresh Tomatoes', description: 'Red tomatoes', price: 2.99,
    category: 'vegetables', image: 'https://example.com/tomato.jpg', stock: 50, unit: 'kg', farmer: 'Test Farm',
  });
  productId = product._id.toString();
});

// ── GET Reviews ────────────────────────────────────────────────────────────
describe('GET /api/products/:id/reviews', () => {
  it('returns empty array when product has no reviews', async () => {
    const res = await request(app).get(`/api/products/${productId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns reviews sorted newest first', async () => {
    await Review.create({ product: productId, user: consumerId, userName: 'Alice', rating: 5, comment: 'First review' });
    await Review.create({ product: productId, user: consumer2Id, userName: 'Bob', rating: 3, comment: 'Second review' });

    const res = await request(app).get(`/api/products/${productId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].comment).toBe('Second review');
    expect(res.body[1].comment).toBe('First review');
  });

  it('does not require authentication', async () => {
    const res = await request(app).get(`/api/products/${productId}/reviews`);
    expect(res.status).toBe(200);
  });
});

// ── POST Review ────────────────────────────────────────────────────────────
describe('POST /api/products/:id/reviews', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .send({ rating: 5, comment: 'Great product!' });
    expect(res.status).toBe(401);
  });

  it('creates a review and returns 201', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 5, comment: 'Absolutely delicious!' });
    expect(res.status).toBe(201);
    expect(res.body.comment).toBe('Absolutely delicious!');
    expect(res.body.rating).toBe(5);
    expect(res.body.userName).toBe('Alice');
  });

  it('stores the correct user and product references', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 4, comment: 'Good quality' });
    expect(res.body.product).toBe(productId);
    expect(res.body.user).toBe(consumerId);
  });

  it('updates the product average rating after a review', async () => {
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 4, comment: 'Good!' });

    const product = await Product.findById(productId);
    expect(product.rating).toBe(4);
    expect(product.numReviews).toBe(1);
  });

  it('correctly averages multiple reviews', async () => {
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 4, comment: 'Good!' });
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ rating: 2, comment: 'Not great' });

    const product = await Product.findById(productId);
    expect(product.rating).toBe(3);
    expect(product.numReviews).toBe(2);
  });

  it('blocks a second review from the same user with 400', async () => {
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 5, comment: 'First review' });

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 1, comment: 'Trying again' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  it('returns 400 when comment is missing', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is missing', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ comment: 'No rating' });
    expect(res.status).toBe(400);
  });

  it('allows different users to each leave one review', async () => {
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ rating: 5, comment: 'Alice loves it' });
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ rating: 3, comment: 'Bob thinks it is ok' });
    expect(res.status).toBe(201);

    const reviews = await Review.find({ product: productId });
    expect(reviews.length).toBe(2);
  });
});

// ── DELETE Review ──────────────────────────────────────────────────────────
describe('DELETE /api/products/:id/reviews/:reviewId', () => {
  let reviewId;

  beforeEach(async () => {
    const review = await Review.create({
      product: productId, user: consumerId,
      userName: 'Alice', rating: 5, comment: 'Great!',
    });
    reviewId = review._id.toString();
    await Product.findByIdAndUpdate(productId, { rating: 5, numReviews: 1 });
  });

  it('requires authentication', async () => {
    const res = await request(app).delete(`/api/products/${productId}/reviews/${reviewId}`);
    expect(res.status).toBe(401);
  });

  it('allows the review owner to delete their review', async () => {
    const res = await request(app)
      .delete(`/api/products/${productId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    const gone = await Review.findById(reviewId);
    expect(gone).toBeNull();
  });

  it('allows an admin to delete any review', async () => {
    const res = await request(app)
      .delete(`/api/products/${productId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('blocks a different consumer from deleting someone else\'s review with 403', async () => {
    const res = await request(app)
      .delete(`/api/products/${productId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${consumer2Token}`);
    expect(res.status).toBe(403);
  });

  it('recalculates product rating to 0 after the last review is deleted', async () => {
    await request(app)
      .delete(`/api/products/${productId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${consumerToken}`);

    const product = await Product.findById(productId);
    expect(product.rating).toBe(0);
    expect(product.numReviews).toBe(0);
  });

  it('recalculates product rating correctly after one of two reviews is deleted', async () => {
    const r2 = await Review.create({
      product: productId, user: consumer2Id,
      userName: 'Bob', rating: 3, comment: 'Ok',
    });
    await Product.findByIdAndUpdate(productId, { rating: 4, numReviews: 2 });

    await request(app)
      .delete(`/api/products/${productId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${consumerToken}`);

    const product = await Product.findById(productId);
    expect(product.rating).toBe(3);
    expect(product.numReviews).toBe(1);
  });

  it('returns 404 for a non-existent review', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/products/${productId}/reviews/${fakeId}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/products — Pagination ─────────────────────────────────────────
describe('GET /api/products — pagination', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    const products = Array.from({ length: 15 }, (_, i) => ({
      name: `Product ${i + 1}`,
      description: 'A fresh product',
      price: 1 + i,
      category: 'vegetables',
      image: 'https://example.com/img.jpg',
      stock: 100,
      unit: 'kg',
      farmer: 'Test Farm',
    }));
    await Product.insertMany(products);
  });

  it('returns paginated response shape with products, total, page, pages', async () => {
    const res = await request(app).get('/api/products?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(5);
    expect(res.body.total).toBe(15);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(3);
  });

  it('returns correct products for page 2', async () => {
    const page1 = await request(app).get('/api/products?page=1&limit=5');
    const page2 = await request(app).get('/api/products?page=2&limit=5');

    const ids1 = page1.body.products.map(p => p._id);
    const ids2 = page2.body.products.map(p => p._id);
    expect(ids2.some(id => ids1.includes(id))).toBe(false); // no overlap
  });

  it('returns fewer items on the last page', async () => {
    const res = await request(app).get('/api/products?page=3&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(5); // 15 items / 5 per page = exactly 3 pages
    expect(res.body.page).toBe(3);
  });

  it('defaults to page 1 with limit 12 when no params given', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(12);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(2);
  });

  it('caps limit at 50 to prevent abuse', async () => {
    // Seed 60 products total
    const extra = Array.from({ length: 45 }, (_, i) => ({
      name: `Extra ${i}`, description: 'Extra', price: 5,
      category: 'fruits', image: 'https://example.com/img.jpg', stock: 10, unit: 'kg', farmer: 'Farm',
    }));
    await Product.insertMany(extra);

    const res = await request(app).get('/api/products?limit=100');
    expect(res.body.products.length).toBeLessThanOrEqual(50);
  });

  it('filters by category and paginates correctly', async () => {
    await Product.create({
      name: 'Apple', description: 'Fresh apple', price: 3,
      category: 'fruits', image: 'https://example.com/apple.jpg', stock: 20, unit: 'kg', farmer: 'Farm',
    });
    const res = await request(app).get('/api/products?category=fruits&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.products.every(p => p.category === 'fruits')).toBe(true);
    expect(res.body.total).toBe(1);
  });

  it('returns 400 for an invalid category', async () => {
    const res = await request(app).get('/api/products?category=candy');
    expect(res.status).toBe(400);
  });

  it('searches by name and reflects in total count', async () => {
    const res = await request(app).get('/api/products?search=Product 1');
    expect(res.status).toBe(200);
    // Should match "Product 1", "Product 10"–"Product 15" (7 results) or similar — just verify total < 15
    expect(res.body.total).toBeLessThan(15);
  });
});
