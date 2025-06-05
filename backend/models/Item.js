const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  unit: { 
    type: String, 
    default: 'pcs' 
  },
  category: String,
  isActive: { 
    type: Boolean, 
    default: true 
  },
  availableAt: [String], // Array of branch codes
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Item', itemSchema);