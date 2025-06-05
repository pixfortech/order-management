
// 📁 Save this as: utils/getOrderModel.js

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: String,
  branch: String,
  createdBy: String,
  items: Array,
  createdAt: { type: Date, default: Date.now }
});

function formatCollectionName(branch) {
  return `orders_${branch.toLowerCase().replace(/\s/g, '')}`;
}

function getOrderModel(branch) {
  const name = formatCollectionName(branch);
  return mongoose.models[name] || mongoose.model(name, orderSchema, name);
}

module.exports = { getOrderModel, formatCollectionName };
