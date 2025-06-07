const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// Occasions collection helper - use mongoose connection
const getOccasionsCollection = () => {
  return mongoose.connection.db.collection('occasions');
};

// GET /api/occasions - Get all occasions from database
router.get('/', auth, async (req, res) => {
  try {
    const collection = getOccasionsCollection();
    const occasions = await collection.find({ isActive: { $ne: false } }).sort({ name: 1 }).toArray();
    
    console.log(`🎉 Found ${occasions.length} occasions in database`);
    res.json(occasions);
  } catch (error) {
    console.error('Error fetching occasions:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/occasions/:id - Get single occasion
router.get('/:id', auth, async (req, res) => {
  try {
    const collection = getOccasionsCollection();
    const { ObjectId } = require('mongodb');
    
    const occasion = await collection.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!occasion) {
      return res.status(404).json({ message: 'Occasion not found' });
    }
    
    res.json(occasion);
  } catch (error) {
    console.error('Error fetching occasion:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/occasions - Create new occasion (admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name, description, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Occasion name is required' });
    }
    
    const collection = getOccasionsCollection();
    
    // Check if occasion already exists
    const existing = await collection.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Occasion with this name already exists' });
    }
    
    const newOccasion = {
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon?.trim() || '🎉',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(newOccasion);
    newOccasion._id = result.insertedId;
    
    console.log('✅ New occasion created:', newOccasion.name);
    res.status(201).json(newOccasion);
  } catch (error) {
    console.error('Error creating occasion:', error);
    res.status(500).json({ message: 'Failed to create occasion', error: error.message });
  }
});

// PUT /api/occasions/:id - Update occasion (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name, description, icon, isActive } = req.body;
    
    const collection = getOccasionsCollection();
    const { ObjectId } = require('mongodb');
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (icon) updateData.icon = icon.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ message: 'Occasion not found' });
    }
    
    console.log('✅ Occasion updated:', result.value.name);
    res.json(result.value);
  } catch (error) {
    console.error('Error updating occasion:', error);
    res.status(500).json({ message: 'Failed to update occasion', error: error.message });
  }
});

// DELETE /api/occasions/:id - Delete occasion (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const collection = getOccasionsCollection();
    const { ObjectId } = require('mongodb');
    
    // Soft delete - mark as inactive instead of actual deletion
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          isActive: false, 
          updatedAt: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ message: 'Occasion not found' });
    }
    
    console.log('✅ Occasion deactivated:', result.value.name);
    res.json({ message: 'Occasion deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating occasion:', error);
    res.status(500).json({ message: 'Failed to deactivate occasion', error: error.message });
  }
});

// GET /api/occasions/search/:query - Search occasions
router.get('/search/:query', auth, async (req, res) => {
  try {
    const collection = getOccasionsCollection();
    const searchQuery = req.params.query;
    
    const occasions = await collection.find({
      $and: [
        { isActive: { $ne: false } },
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    }).sort({ name: 1 }).toArray();
    
    console.log(`🔍 Found ${occasions.length} occasions matching "${searchQuery}"`);
    res.json(occasions);
  } catch (error) {
    console.error('Error searching occasions:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;