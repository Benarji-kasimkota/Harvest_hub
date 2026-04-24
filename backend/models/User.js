const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { 
    type: String, 
    enum: ['consumer', 'retailer', 'delivery', 'admin'], 
    default: 'consumer' 
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'active'
  },
  avatar: { type: String },
  phone: { type: String },
  address: {
    street: String, city: String, state: String, zipCode: String, country: String
  },
  // Retailer specific
  storeName: { type: String },
  storeDescription: { type: String },
  // Delivery specific
  vehicleType: { type: String },
  isAvailable: { type: Boolean, default: true },
  // Auth
  refreshToken: { type: String, select: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
