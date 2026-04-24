const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String, image: String, price: Number, quantity: Number
  }],
  shippingAddress: { street: String, city: String, state: String, zipCode: String, country: String },
  deliveryPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paymentMethod: { type: String, default: 'stripe' },
  paymentIntentId: { type: String },
  paymentResult: { id: String, status: String, email: String },
  subtotal: { type: Number, required: true },
  shippingPrice: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  tip: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending','processing','shipped','out_for_delivery','delivered','cancelled'],
    default: 'pending'
  },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  isDelivered: { type: Boolean, default: false },
  deliveredAt: Date,
  deliveryNotes: String
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
