const mongoose = require('mongoose');

// Simple order schema for dynamic collections
const orderSchema = new mongoose.Schema({
  customerName: String,
  phone: String,
  address: String,
  email: String,
  pincode: String,
  city: String,
  state: String,
  occasion: String,
  orderPrefix: String,
  orderNumber: { type: String, unique: true },
  orderDate: String,
  deliveryDate: String,
  deliveryTime: String,
  notes: String,
  boxes: [{
    items: [{
      name: String,
      qty: Number,
      price: Number,
      unit: String,
      amount: Number,
      customName: Boolean
    }],
    discount: Number,
    total: Number,
    boxCount: Number
  }],
  extraDiscount: {
    value: Number,
    type: String
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
  branch: String,
  branchCode: String,
  createdBy: String
}, { 
  timestamps: true 
});

// Simple customer schema
const customerSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  address: String,
  pincode: String,
  city: String,
  state: String,
  branch: String,
  branchCode: String,
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastOrderDate: Date
}, { 
  timestamps: true 
});

const getOrderModel = (branchCode) => {
  const modelName = `Order_${branchCode.toUpperCase()}`;
  
  // Check if model already exists
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }
  
  // Create and return new model
  return mongoose.model(modelName, orderSchema, `orders_${branchCode.toLowerCase()}`);
};

const getCustomerModel = (branchCode) => {
  const modelName = `Customer_${branchCode.toUpperCase()}`;
  
  // Check if model already exists
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }
  
  // Create and return new model
  return mongoose.model(modelName, customerSchema, `customers_${branchCode.toLowerCase()}`);
};

module.exports = {
  getOrderModel,
  getCustomerModel
};