const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { 
    type: String, 
    enum: ['vegetables', 'fruits', 'meat', 'dairy', 'grains'],
    required: true 
  },
  image: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'kg' },
  farmer: { type: String, default: 'Local Farm' },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  retailer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
