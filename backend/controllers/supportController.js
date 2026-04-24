const SupportTicket = require('../models/SupportTicket');
const nodemailer = require('nodemailer');

// Escape HTML to prevent injection in email templates
const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email not configured - ticket saved to DB only');
      return;
    }
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"HarvestHub Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.log('Email error:', err.message);
  }
};

exports.createTicket = async (req, res, next) => {
  try {
    const { subject, message, category, orderId } = req.body;

    const priorityMap = {
      payment: 'high', refund: 'high', delivery: 'medium',
      order: 'medium', technical: 'high', general: 'low',
      product: 'low', account: 'medium'
    };

    const ticket = await SupportTicket.create({
      user: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      subject,
      message,
      category: category || 'general',
      orderId,
      priority: priorityMap[category] || 'medium'
    });

    const ticketRef = ticket._id.toString().slice(-6).toUpperCase();

    await sendEmail(
      req.user.email,
      `Support Ticket #${ticketRef} Received - HarvestHub`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2d6a4f;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;">HarvestHub Support</h1>
        </div>
        <div style="background:#f8f9f4;padding:24px;border-radius:0 0 12px 12px;">
          <p>Hi <strong>${escapeHtml(req.user.name)}</strong>,</p>
          <p>We've received your support ticket and will respond within <strong>24 hours</strong>.</p>
          <div style="background:white;border-left:4px solid #2d6a4f;padding:16px;border-radius:8px;margin:16px 0;">
            <p><strong>Ticket ID:</strong> #${ticketRef}</p>
            <p><strong>Category:</strong> ${escapeHtml(category)}</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <p><strong>Status:</strong> Open</p>
          </div>
          <p>Need urgent help? Call us at <strong>${escapeHtml(process.env.SUPPORT_PHONE || '1-800-555-1234')}</strong></p>
          <p style="color:#6c757d;font-size:0.85rem;">${escapeHtml(process.env.SUPPORT_HOURS || 'Mon-Fri 9AM-6PM EST')}</p>
        </div>
      </div>`
    );

    if (process.env.ADMIN_EMAIL) {
      await sendEmail(
        process.env.ADMIN_EMAIL,
        `New Support Ticket: ${subject}`,
        `<div style="font-family:sans-serif;">
          <h2>New Support Ticket</h2>
          <p><strong>From:</strong> ${escapeHtml(req.user.name)} (${escapeHtml(req.user.email)})</p>
          <p><strong>Role:</strong> ${escapeHtml(req.user.role)}</p>
          <p><strong>Category:</strong> ${escapeHtml(category)}</p>
          <p><strong>Priority:</strong> ${escapeHtml(priorityMap[category] || 'medium')}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Message:</strong> ${escapeHtml(message)}</p>
          ${orderId ? `<p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>` : ''}
        </div>`
      );
    }

    res.status(201).json({
      message: 'Support ticket submitted successfully!',
      ticketId: ticketRef,
      ticket
    });
  } catch (err) { next(err); }
};

exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) { next(err); }
};

exports.getAllTickets = async (req, res, next) => {
  try {
    const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const query = {};
    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) return res.status(400).json({ message: 'Invalid status filter' });
      query.status = req.query.status;
    }
    if (req.query.priority) {
      if (!VALID_PRIORITIES.includes(req.query.priority)) return res.status(400).json({ message: 'Invalid priority filter' });
      query.priority = req.query.priority;
    }
    const tickets = await SupportTicket.find(query).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) { next(err); }
};

exports.updateTicket = async (req, res, next) => {
  try {
    const { status, adminNotes, response } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (status) ticket.status = status;
    if (adminNotes) ticket.adminNotes = adminNotes;
    if (status === 'resolved') ticket.resolvedAt = Date.now();

    if (response) {
      ticket.responses.push({ message: response, from: 'admin' });
    }

    await ticket.save();

    if (response) {
      await sendEmail(
        ticket.userEmail,
        `Re: Support Ticket #${ticket._id.toString().slice(-6).toUpperCase()}`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2d6a4f;padding:24px;border-radius:12px 12px 0 0;">
            <h1 style="color:white;margin:0;">HarvestHub Support</h1>
          </div>
          <div style="background:#f8f9f4;padding:24px;">
            <p>Hi <strong>${escapeHtml(ticket.userName)}</strong>,</p>
            <p>Our support team has responded to your ticket:</p>
            <div style="background:white;border-left:4px solid #52b788;padding:16px;border-radius:8px;margin:16px 0;">
              <p>${escapeHtml(response)}</p>
            </div>
            <p><strong>Ticket Status:</strong> ${escapeHtml(status || ticket.status)}</p>
            <p style="color:#6c757d;">Ticket #${ticket._id.toString().slice(-6).toUpperCase()}</p>
          </div>
        </div>`
      );
    }

    res.json(ticket);
  } catch (err) { next(err); }
};
