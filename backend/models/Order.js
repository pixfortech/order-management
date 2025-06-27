// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Phone number must be exactly 10 digits'
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  address: {
    type: String,
    trim: true
  },
  
  // Branch information
  branchCode: {
    type: String,
    required: true,
    uppercase: true
  },
  branchName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Order details
  orderDate: {
    type: Date,
    default: Date.now
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  occasion: {
    type: String,
    trim: true
  },
  
  // Box information
  boxes: [{
    boxType: {
      type: String,
      required: true
    },
    boxCount: {
      type: Number,
      required: true,
      min: 1
    },
    items: [{
      itemName: String,
      quantity: Number,
      unitPrice: Number,
      totalPrice: Number
    }],
    boxPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  totalBoxCount: {
    type: Number,
    default: 0
  },
  
  // Pricing
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Payment tracking
  advancePaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balancePaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Payment dates
  advancePaidDate: {
    type: Date,
    default: null
  },
  balancePaidDate: {
    type: Date,
    default: null
  },
  
  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Payment status
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  
  // Additional notes
  notes: {
    type: String,
    trim: true
  },
  
  // Tracking
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true,
  // Add indexes for better performance
  indexes: [
    { orderNumber: 1 },
    { customerName: 1 },
    { phone: 1 },
    { branchCode: 1 },
    { deliveryDate: 1 },
    { status: 1 },
    { paymentStatus: 1 }
  ]
});

// Pre-save middleware to calculate totals and balance
orderSchema.pre('save', function(next) {
  // Calculate total box count
  if (this.boxes && this.boxes.length > 0) {
    this.totalBoxCount = this.boxes.reduce((total, box) => total + (box.boxCount || 0), 0);
  }
  
  // Calculate balance
  this.balance = Math.max(0, this.grandTotal - this.advancePaid - this.balancePaid);
  
  // Update payment status based on payments
  if (this.balance === 0 && this.grandTotal > 0) {
    this.paymentStatus = 'paid';
  } else if (this.advancePaid > 0 || this.balancePaid > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'unpaid';
  }
  
  next();
});

// Instance methods
orderSchema.methods.getDisplayOrderNumber = function() {
  return `${this.branchCode}-${this.orderNumber}`;
};

orderSchema.methods.getTotalItems = function() {
  if (!this.boxes || this.boxes.length === 0) return 0;
  
  return this.boxes.reduce((total, box) => {
    if (!box.items || box.items.length === 0) return total;
    return total + box.items.reduce((boxTotal, item) => boxTotal + (item.quantity || 0), 0);
  }, 0);
};

orderSchema.methods.isFullyPaid = function() {
  return this.balance === 0 && this.grandTotal > 0;
};

orderSchema.methods.isOverdue = function(days = 0) {
  const deliveryDate = new Date(this.deliveryDate);
  const overdueDate = new Date(deliveryDate.getTime() + (days * 24 * 60 * 60 * 1000));
  return new Date() > overdueDate && !this.isFullyPaid();
};

// Static methods
orderSchema.statics.findByBranch = function(branchCode) {
  return this.find({ branchCode: branchCode.toUpperCase() });
};

orderSchema.statics.findByCustomer = function(customerName, phone) {
  const query = {};
  if (customerName) query.customerName = customerName;
  if (phone) query.phone = phone;
  return this.find(query);
};

orderSchema.statics.findOverdue = function(days = 0) {
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - days);
  
  return this.find({
    deliveryDate: { $lt: overdueDate },
    paymentStatus: { $ne: 'paid' }
  });
};

orderSchema.statics.getOrderStats = function(branchCode = null) {
  const matchStage = branchCode ? { branchCode: branchCode.toUpperCase() } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        totalAdvancePaid: { $sum: '$advancePaid' },
        totalBalancePaid: { $sum: '$balancePaid' },
        pendingBalance: { $sum: '$balance' },
        totalBoxes: { $sum: '$totalBoxCount' }
      }
    }
  ]);
};

// Virtual for full customer info
orderSchema.virtual('customerInfo').get(function() {
  return {
    name: this.customerName,
    phone: this.phone,
    email: this.email,
    address: this.address
  };
});

// Virtual for payment info
orderSchema.virtual('paymentInfo').get(function() {
  return {
    grandTotal: this.grandTotal,
    advancePaid: this.advancePaid,
    balancePaid: this.balancePaid,
    balance: this.balance,
    paymentStatus: this.paymentStatus,
    isFullyPaid: this.isFullyPaid()
  };
});

// Ensure virtual fields are serialized
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);