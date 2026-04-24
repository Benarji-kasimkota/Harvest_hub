process.env.JWT_SECRET = 'test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');
const bcrypt = require('bcryptjs');

let mongoServer;
let consumerToken;
let consumerId;
let adminToken;
let consumer2Token;

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
  await SupportTicket.deleteMany({});

  const hash = await bcrypt.hash('Password123', 12);

  await User.create({ name: 'Admin', email: 'admin@test.com', password: hash, role: 'admin', status: 'active' });

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'Password123' });
  adminToken = adminRes.body.token;

  const c1Res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Alice', email: 'alice@test.com', password: 'Password123' });
  consumerToken = c1Res.body.token;
  consumerId = c1Res.body._id;

  const c2Res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Bob', email: 'bob@test.com', password: 'Password123' });
  consumer2Token = c2Res.body.token;
});

// ── Access Control ─────────────────────────────────────────────────────────
describe('Support route access control', () => {
  it('blocks unauthenticated ticket creation with 401', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .send({ subject: 'Help!', message: 'I need help', category: 'general' });
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to my-tickets with 401', async () => {
    const res = await request(app).get('/api/support/my-tickets');
    expect(res.status).toBe(401);
  });

  it('blocks non-admin from GET /api/support/all with 403', async () => {
    const res = await request(app)
      .get('/api/support/all')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks non-admin from updating a ticket with 403', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/support/${fakeId}`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(403);
  });
});

// ── Create Ticket ──────────────────────────────────────────────────────────
describe('POST /api/support/ticket', () => {
  it('creates a ticket and returns ticketId', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Order issue', message: 'My order did not arrive', category: 'order' });
    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBeDefined();
    expect(res.body.ticket.subject).toBe('Order issue');
    expect(res.body.ticket.status).toBe('open');
  });

  it('stores the correct user info on the ticket', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Test!', message: 'Test message', category: 'general' });
    expect(res.body.ticket.userName).toBe('Alice');
    expect(res.body.ticket.userEmail).toBe('alice@test.com');
    expect(res.body.ticket.userRole).toBe('consumer');
  });

  it('auto-assigns high priority for payment category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Charged twice', message: 'I was billed twice', category: 'payment' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.priority).toBe('high');
  });

  it('auto-assigns high priority for technical category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'App crash', message: 'App crashes on login', category: 'technical' });
    expect(res.body.ticket.priority).toBe('high');
  });

  it('auto-assigns high priority for refund category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Need refund', message: 'Wrong item delivered', category: 'refund' });
    expect(res.body.ticket.priority).toBe('high');
  });

  it('auto-assigns medium priority for delivery category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Late delivery', message: 'Package is delayed', category: 'delivery' });
    expect(res.body.ticket.priority).toBe('medium');
  });

  it('auto-assigns medium priority for order category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Wrong item', message: 'Sent wrong product', category: 'order' });
    expect(res.body.ticket.priority).toBe('medium');
  });

  it('auto-assigns low priority for general category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Question', message: 'General enquiry', category: 'general' });
    expect(res.body.ticket.priority).toBe('low');
  });

  it('auto-assigns low priority for product category', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Product question', message: 'Is this organic?', category: 'product' });
    expect(res.body.ticket.priority).toBe('low');
  });

  it('defaults category to general when not provided', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Hello!', message: 'Just checking in' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.category).toBe('general');
  });

  it('stores optional orderId on the ticket', async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Order missing', message: 'Where is my order?', category: 'order', orderId: 'ORD-12345' });
    expect(res.body.ticket.orderId).toBe('ORD-12345');
  });
});

// ── Get My Tickets ─────────────────────────────────────────────────────────
describe('GET /api/support/my-tickets', () => {
  it('returns only the current user\'s tickets', async () => {
    // Alice creates 2 tickets, Bob creates 1
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Alice ticket 1', message: 'Please help me!', category: 'general' });
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Alice ticket 2', message: 'Please help me!', category: 'order' });
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ subject: 'Bob ticket', message: 'Please help me!', category: 'general' });

    const res = await request(app)
      .get('/api/support/my-tickets')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every(t => t.userName === 'Alice')).toBe(true);
  });

  it('returns empty array when user has no tickets', async () => {
    const res = await request(app)
      .get('/api/support/my-tickets')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns tickets sorted by newest first', async () => {
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'First', message: 'Please help me!', category: 'general' });
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Second', message: 'Please help me!', category: 'general' });

    const res = await request(app)
      .get('/api/support/my-tickets')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.body[0].subject).toBe('Second');
    expect(res.body[1].subject).toBe('First');
  });
});

// ── Admin: Get All Tickets ─────────────────────────────────────────────────
describe('GET /api/support/all', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Open general', message: 'Please help me!', category: 'general' });
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Open payment', message: 'Please help me!', category: 'payment' });
    await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ subject: 'Bob delivery', message: 'Please help me!', category: 'delivery' });
  });

  it('returns all tickets for admin', async () => {
    const res = await request(app)
      .get('/api/support/all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it('filters tickets by status', async () => {
    const ticket = await SupportTicket.findOne({ subject: 'Open general' });
    await SupportTicket.findByIdAndUpdate(ticket._id, { status: 'resolved' });

    const res = await request(app)
      .get('/api/support/all?status=resolved')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('resolved');
  });

  it('filters tickets by priority', async () => {
    const res = await request(app)
      .get('/api/support/all?priority=high')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.priority === 'high')).toBe(true);
  });
});

// ── Admin: Update Ticket ───────────────────────────────────────────────────
describe('PUT /api/support/:id', () => {
  let ticketId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/support/ticket')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ subject: 'Need help', message: 'Something broke', category: 'technical' });
    ticketId = res.body.ticket._id;
  });

  it('updates ticket status to in_progress', async () => {
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('sets resolvedAt when status is changed to resolved', async () => {
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.resolvedAt).toBeDefined();
  });

  it('does not set resolvedAt for non-resolved status changes', async () => {
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.body.resolvedAt).toBeFalsy();
  });

  it('saves adminNotes on the ticket', async () => {
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ adminNotes: 'Escalated to engineering team' });
    expect(res.status).toBe(200);
    expect(res.body.adminNotes).toBe('Escalated to engineering team');
  });

  it('appends a response to the responses array', async () => {
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ response: 'We are looking into this.' });
    expect(res.status).toBe(200);
    expect(res.body.responses).toHaveLength(1);
    expect(res.body.responses[0].message).toBe('We are looking into this.');
    expect(res.body.responses[0].from).toBe('admin');
  });

  it('appends multiple responses over time', async () => {
    await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ response: 'First reply' });
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ response: 'Second reply' });
    expect(res.body.responses).toHaveLength(2);
  });

  it('returns 404 for a non-existent ticket ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/support/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  it('can update status and add a response in a single request', async () => {
    const res = await request(app)
      .put(`/api/support/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', response: 'Issue fixed!', adminNotes: 'Resolved via hotfix' });
    expect(res.body.status).toBe('resolved');
    expect(res.body.responses).toHaveLength(1);
    expect(res.body.adminNotes).toBe('Resolved via hotfix');
    expect(res.body.resolvedAt).toBeDefined();
  });
});
