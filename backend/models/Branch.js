// models/Branch.js
const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  branchName: { 
    type: String, 
    required: [true, 'Branch name is required'],
    unique: true,
    trim: true,
    maxLength: [100, 'Branch name cannot exceed 100 characters']
  },
  branchCode: { 
    type: String, 
    required: [true, 'Branch code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxLength: [3, 'Branch code cannot exceed 3 characters'],
    match: [/^[A-Z0-9]+$/, 'Branch code must contain only uppercase letters and numbers']
  },
  address: {
    type: String,
    trim: true,
    maxLength: [500, 'Address cannot exceed 500 characters']
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[0-9]{10}$/.test(v);
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
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // Additional fields for better branch management
  manager: {
    type: String,
    trim: true,
    maxLength: [100, 'Manager name cannot exceed 100 characters']
  },
  establishedDate: {
    type: Date
  },
  // Store metadata for better tracking
  metadata: {
    totalCustomers: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    lastOrderDate: {
      type: Date
    }
  }
}, { 
  timestamps: true,
  // Add indexes for better performance
  indexes: [
    { branchCode: 1 },
    { branchName: 1 },
    { isActive: 1 }
  ]
});

// Middleware to ensure branchCode is always uppercase
branchSchema.pre('save', function(next) {
  if (this.branchCode) {
    this.branchCode = this.branchCode.toUpperCase();
  }
  next();
});

// Instance methods
branchSchema.methods.getCustomerCollectionName = function() {
  return `customers_${this.branchCode.toLowerCase()}`;
};

branchSchema.methods.getOrderCollectionName = function() {
  return `orders_${this.branchCode.toLowerCase()}`;
};

branchSchema.methods.getDisplayName = function() {
  return `${this.branchName} (${this.branchCode})`;
};

// Static methods
branchSchema.statics.findByCode = function(code) {
  return this.findOne({ 
    branchCode: code.toUpperCase(), 
    isActive: { $ne: false } 
  });
};

branchSchema.statics.findByName = function(name) {
  return this.findOne({ 
    branchName: new RegExp(`^${name}$`, 'i'), 
    isActive: { $ne: false } 
  });
};

branchSchema.statics.getActiveBranches = function() {
  return this.find({ isActive: { $ne: false } })
    .sort({ branchName: 1 })
    .select('branchName branchCode address phone email manager');
};

// Virtual for full display info
branchSchema.virtual('displayInfo').get(function() {
  return {
    name: this.branchName,
    code: this.branchCode,
    fullName: this.getDisplayName(),
    isActive: this.isActive
  };
});

// Ensure virtual fields are serialized
branchSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Branch', branchSchema);