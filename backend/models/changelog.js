// models/Changelog.js
const mongoose = require('mongoose');

const changelogSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['created', 'updated', 'deleted', 'status_changed', 'payment_added', 'progress_updated'],
    index: true
  },
  changes: [{
    field: String,
    oldValue: String,
    newValue: String,
    displayName: String
  }],
  user: {
    id: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    displayName: String,
    role: {
      type: String,
      required: true
    }
  },
  systemInfo: {
    userAgent: String,
    ipAddress: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
changelogSchema.index({ orderId: 1, createdAt: -1 });
changelogSchema.index({ orderNumber: 1, createdAt: -1 });
changelogSchema.index({ action: 1, createdAt: -1 });
changelogSchema.index({ 'user.username': 1, createdAt: -1 });

// Add a method to format the changelog entry for display
changelogSchema.methods.toDisplayFormat = function() {
  return {
    id: this._id,
    orderId: this.orderId,
    orderNumber: this.orderNumber,
    action: this.action,
    changes: this.changes,
    user: this.user,
    systemInfo: this.systemInfo,
    timestamp: this.createdAt
  };
};

// Static method to get changelog for an order
changelogSchema.statics.getOrderChangelog = function(orderId) {
  return this.find({ orderId })
    .sort({ createdAt: -1 })
    .exec();
};

// Static method to get changelog summary for multiple orders
changelogSchema.statics.getOrdersSummary = function(orderIds) {
  return this.aggregate([
    { $match: { orderId: { $in: orderIds } } },
    { $group: { _id: '$orderId', count: { $sum: 1 } } }
  ]);
};

const Changelog = mongoose.model('Changelog', changelogSchema);

module.exports = Changelog;