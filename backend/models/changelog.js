const mongoose = require('mongoose');

const changelogSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  action: { 
    type: String, 
    required: true,
    enum: ['created', 'updated', 'deleted', 'status_changed', 'payment_added', 'progress_updated']
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    displayName: String
  }],
  user: {
    id: mongoose.Schema.Types.ObjectId,
    username: String,
    displayName: String,
    role: String
  },
  systemInfo: {
    userAgent: String,
    ipAddress: String,
    timestamp: { type: Date, default: Date.now }
  },
  notes: String
}, {
  timestamps: true
});

// Index for better query performance
changelogSchema.index({ orderId: 1, createdAt: -1 });
changelogSchema.index({ orderNumber: 1, createdAt: -1 });

module.exports = mongoose.model('Changelog', changelogSchema);