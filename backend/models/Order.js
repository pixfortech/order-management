// models/Order.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: String,
  qty: Number,
  price: Number,
  unit: String,
  amount: Number,
  customName: Boolean // ✅ ADDED: to support custom item logic
});

const boxSchema = new mongoose.Schema({
  items: [itemSchema],
  discount: Number,
  total: Number,
  boxCount: Number // ✅ ADDED: used in calculation
});

const orderSchema = new mongoose.Schema({
  customerName: String,
  phone: String,
  address: String,
  email: String,
  occasion: String,
  orderPrefix: String,
  orderNumber: {
    type: String,
    required: true,
    unique: true // ✅ RECOMMENDED: if you're enforcing uniqueness
  },
  orderDate: String,
  deliveryDate: String,
  deliveryTime: String,
  notes: String,
  boxes: [boxSchema],
  extraDiscount: {
  value: { type: Number, default: 0 },
  type: { type: String, default: 'value' }
},

  advancePaid: Number,
  totalBoxCount: Number, // ✅ ADDED
  grandTotal: Number,
  balance: Number,
  status: {
    type: String,
    enum: ['saved', 'held', 'auto-saved'],
    default: 'saved'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);