// models/Order.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: String,
  qty: Number,
  price: Number,
  unit: String,
  amount: Number,
  customName: Boolean
});

const boxSchema = new mongoose.Schema({
  items: [itemSchema],
  discount: Number,
  total: Number,
  boxCount: Number
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
    required: true
    // ✅ REMOVED: unique: true - this was causing the ObjectId validation error
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
  totalBoxCount: Number,
  grandTotal: Number,
  balance: Number,
  status: {
    type: String,
    enum: ['saved', 'held', 'auto-saved'],
    default: 'saved'
  },
  // ✅ ADDED: Branch information for better organization
  branch: String,
  branchCode: String
}, { 
  timestamps: true,
  // ✅ ADDED: Create compound index for better performance and branch-specific uniqueness
  indexes: [
    { orderNumber: 1, branchCode: 1 } // Unique within each branch
  ]
});

module.exports = mongoose.model('Order', orderSchema);