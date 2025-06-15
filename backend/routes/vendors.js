const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Vendor Schema - defining it directly in this file for simplicity
const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: String,
  address: String
}, {
  timestamps: true
});

// Create Vendor model
const Vendor = mongoose.model('Vendor', vendorSchema);

// GET /api/vendors - Get all vendors
router.get('/', async (req, res) => {
  try {
    console.log('📡 Fetching vendors from database...');
    const vendors = await Vendor.find({}).sort({ name: 1 });
    console.log('✅ Found vendors:', vendors.length);
    res.json(vendors);
  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    res.status(500).json({ message: 'Error fetching vendors', error: error.message });
  }
});

// POST /api/vendors - Create new vendor (optional for future use)
router.post('/', async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    const newVendor = new Vendor({ name, contact, address });
    const savedVendor = await newVendor.save();
    res.status(201).json(savedVendor);
  } catch (error) {
    console.error('❌ Error creating vendor:', error);
    res.status(500).json({ message: 'Error creating vendor', error: error.message });
  }
});

module.exports = router;