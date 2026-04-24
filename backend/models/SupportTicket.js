const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, maxlength: 100 },
  userEmail: { type: String, maxlength: 254 },
  userRole: { type: String, maxlength: 20 },
  subject: { type: String, required: true, maxlength: 200 },
  message: { type: String, required: true, maxlength: 5000 },
  category: { 
    type: String, 
    enum: ['general','order','payment','delivery','product','account','refund','technical'],
    default: 'general'
  },
  orderId: String,
  status: { 
    type: String, 
    enum: ['open','in_progress','resolved','closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low','medium','high','urgent'],
    default: 'medium'
  },
  adminNotes: { type: String, maxlength: 2000 },
  resolvedAt: Date,
  responses: [{
    message: { type: String, maxlength: 5000 },
    from: { type: String, maxlength: 20 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
