const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Use mongoose instead of connectDB
const { auth } = require('../middleware/auth');

// Brand collection helper - use mongoose connection
const getBrandCollection = () => {
  return mongoose.connection.db.collection('brand');
};

// Initialize brand with default data if doesn't exist
const initializeBrand = async () => {
  try {
    const collection = getBrandCollection();
    const existingBrand = await collection.findOne({});
    
    if (!existingBrand) {
      const defaultBrand = {
        name: 'Ganguram Sweets',
        displayName: 'Ganguram',
        address: '',
        gst: '',
        email: '',
        phone: '',
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await collection.insertOne(defaultBrand);
      console.log('✅ Default brand created');
      return defaultBrand;
    }
    
    return existingBrand;
  } catch (error) {
    console.error('❌ Error initializing brand:', error);
    throw error;
  }
};

// GET /api/brand - Get brand details
router.get('/', auth, async (req, res) => {
  try {
    const brand = await initializeBrand();
    res.json(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// PUT /api/brand - Update brand details
router.put('/', auth, async (req, res) => {
  try {
    const collection = getBrandCollection();
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // Remove _id if present to avoid update conflicts
    delete updateData._id;
    
    const result = await collection.findOneAndUpdate(
      {}, // Find any brand document (should be only one)
      { $set: updateData },
      { 
        upsert: true, // Create if doesn't exist
        returnDocument: 'after' // Return updated document
      }
    );
    
    console.log('✅ Brand updated successfully');
    res.json(result.value || result);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ message: 'Failed to update brand', error: error.message });
  }
});

// POST /api/brand - Create brand (alternative endpoint)
router.post('/', auth, async (req, res) => {
  try {
    const collection = getBrandCollection();
    
    const brandData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(brandData);
    brandData._id = result.insertedId;
    
    res.status(201).json(brandData);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ message: 'Failed to create brand', error: error.message });
  }
});

module.exports = router;