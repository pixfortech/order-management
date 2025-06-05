
// 📁 Save this as: models/OrderCounter.js

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  branch: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 }
});

module.exports = mongoose.model('OrderCounter', counterSchema);
