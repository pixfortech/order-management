const mongoose = require('mongoose');

const occasionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    maxLength: 3 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Occasion', occasionSchema);