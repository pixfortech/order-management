const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  branchName: { 
    type: String, 
    required: true, 
    unique: true 
  },
  branchCode: { 
    type: String, 
    required: true, 
    unique: true, 
    maxLength: 2 
  },
  address: String,
  phone: String,
  email: String,
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Branch', branchSchema);