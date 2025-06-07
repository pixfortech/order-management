const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// Items collection helper - use mongoose connection
const getItemsCollection = () => {
  return mongoose.connection.db.collection('items');
};

// GET /api/items - Get all items from database
router.get('/', auth, async (req, res) => {
  try {
    const collection = getItemsCollection();
    const items = await collection.find({ isActive: { $ne: false } }).toArray();
    
    console.log(`📦 Found ${items.length} items in database`);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/items/:id - Get single item
router.get('/:id', auth, async (req, res) => {
  try {
    const collection = getItemsCollection();
    const { ObjectId } = require('mongodb');
    
    const item = await collection.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/items - Create new item (admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name, price, category, description, unit } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ message: 'Item name and price are required' });
    }
    
    const collection = getItemsCollection();
    
    // Check if item already exists
    const existing = await collection.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Item with this name already exists' });
    }
    
    const newItem = {
      name: name.trim(),
      price: parseFloat(price),
      category: category?.trim() || 'General',
      description: description?.trim() || '',
      unit: unit?.trim() || 'piece',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(newItem);
    newItem._id = result.insertedId;
    
    console.log('✅ New item created:', newItem.name);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Failed to create item', error: error.message });
  }
});

// PUT /api/items/:id - Update item (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name, price, category, description, unit, isActive } = req.body;
    
    const collection = getItemsCollection();
    const { ObjectId } = require('mongodb');
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (name) updateData.name = name.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (category) updateData.category = category.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (unit) updateData.unit = unit.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    console.log('✅ Item updated:', result.value.name);
    res.json(result.value);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item', error: error.message });
  }
});

// DELETE /api/items/:id - Delete item (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const collection = getItemsCollection();
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
      return res.status(404).json({ message: 'Item not found' });
    }
    
    console.log('✅ Item deactivated:', result.value.name);
    res.json({ message: 'Item deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating item:', error);
    res.status(500).json({ message: 'Failed to deactivate item', error: error.message });
  }
});

// GET /api/items/search/:query - Search items
router.get('/search/:query', auth, async (req, res) => {
  try {
    const collection = getItemsCollection();
    const searchQuery = req.params.query;
    
    const items = await collection.find({
      $and: [
        { isActive: { $ne: false } },
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { category: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`🔍 Found ${items.length} items matching "${searchQuery}"`);
    res.json(items);
  } catch (error) {
    console.error('Error searching items:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;