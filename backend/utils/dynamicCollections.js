const mongoose = require('mongoose');

// ✅ FIXED: Item schema with _id disabled
const itemSchema = new mongoose.Schema({
  name: String,
  qty: Number,
  price: Number,
  unit: String,
  amount: Number,
  customName: Boolean
}, { 
  _id: false  // ✅ ADDED: Disable _id for embedded documents
});

// ✅ FIXED: Box schema with _id disabled
const boxSchema = new mongoose.Schema({
  items: [itemSchema],
  discount: Number,
  total: Number,
  boxCount: Number
}, { 
  _id: false  // ✅ ADDED: Disable _id for embedded documents
});

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
  orderNumber: { type: String }, // Removed unique constraint
  orderDate: String,
  deliveryDate: String,
  deliveryTime: String,
  notes: String,
  boxes: [boxSchema], // ✅ FIXED: Use the boxSchema with _id disabled
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
  try {
    // ✅ FIXED: Consistent case handling
    console.log('🏪 Creating order model for branchCode:', branchCode);
    
    if (!branchCode || typeof branchCode !== 'string') {
      throw new Error(`Invalid branchCode: ${branchCode}`);
    }
    
    // Always use lowercase for collection names to match your database
    const normalizedBranchCode = branchCode.toLowerCase();
    const collectionName = `orders_${normalizedBranchCode}`;
    const modelName = `Order_${branchCode.toUpperCase()}`; // Model name can be uppercase
    
    console.log('📦 Collection name:', collectionName);
    console.log('🏷️ Model name:', modelName);
    
    // Check if model already exists
    if (mongoose.models[modelName]) {
      console.log('♻️ Reusing existing model:', modelName);
      return mongoose.models[modelName];
    }
    
    // Create and return new model
    console.log('🆕 Creating new model:', modelName);
    const model = mongoose.model(modelName, orderSchema, collectionName);
    
    console.log('✅ Order model created successfully');
    return model;
    
  } catch (error) {
    console.error('❌ Error in getOrderModel:', error);
    throw error;
  }
};

const getCustomerModel = (branchCode) => {
  try {
    // ✅ FIXED: Consistent case handling
    console.log('👤 Creating customer model for branchCode:', branchCode);
    
    if (!branchCode || typeof branchCode !== 'string') {
      throw new Error(`Invalid branchCode: ${branchCode}`);
    }
    
    // Always use lowercase for collection names to match your database
    const normalizedBranchCode = branchCode.toLowerCase();
    const collectionName = `customers_${normalizedBranchCode}`;
    const modelName = `Customer_${branchCode.toUpperCase()}`; // Model name can be uppercase
    
    console.log('📦 Collection name:', collectionName);
    console.log('🏷️ Model name:', modelName);
    
    // Check if model already exists
    if (mongoose.models[modelName]) {
      console.log('♻️ Reusing existing model:', modelName);
      return mongoose.models[modelName];
    }
    
    // Create and return new model
    console.log('🆕 Creating new model:', modelName);
    const model = mongoose.model(modelName, customerSchema, collectionName);
    
    console.log('✅ Customer model created successfully');
    return model;
    
  } catch (error) {
    console.error('❌ Error in getCustomerModel:', error);
    throw error;
  }
};

module.exports = {
  getOrderModel,
  getCustomerModel
};