const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// Branches collection helper - use mongoose connection
const getBranchesCollection = () => {
  return mongoose.connection.db.collection('branches');
};

// GET /api/branches - Get all branches from database
router.get('/', auth, async (req, res) => {
  try {
    const collection = getBranchesCollection();
    const branches = await collection.find({}).toArray();
    
    console.log(`📋 Found ${branches.length} branches in database`);
    res.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/branches - Create new branch (admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { branchName, branchCode } = req.body;
    
    if (!branchName || !branchCode) {
      return res.status(400).json({ message: 'Branch name and code are required' });
    }
    
    const collection = getBranchesCollection();
    
    // Check if branch already exists
    const existing = await collection.findOne({ 
      $or: [
        { branchName: branchName.trim() }, 
        { branchCode: branchCode.trim().toUpperCase() }
      ] 
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Branch name or code already exists' });
    }
    
    const newBranch = {
      branchName: branchName.trim(),
      branchCode: branchCode.trim().toUpperCase(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(newBranch);
    newBranch._id = result.insertedId;
    
    console.log('✅ New branch created:', newBranch.branchName);
    res.status(201).json(newBranch);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ message: 'Failed to create branch', error: error.message });
  }
});

// PUT /api/branches/:id - Update branch (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { branchName, branchCode } = req.body;
    
    if (!branchName || !branchCode) {
      return res.status(400).json({ message: 'Branch name and code are required' });
    }
    
    const collection = getBranchesCollection();
    const { ObjectId } = require('mongodb');
    
    const updateData = {
      branchName: branchName.trim(),
      branchCode: branchCode.trim().toUpperCase(),
      updatedAt: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    console.log('✅ Branch updated:', result.value.branchName);
    res.json(result.value);
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ message: 'Failed to update branch', error: error.message });
  }
});

// DELETE /api/branches/:id - Delete branch (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const collection = getBranchesCollection();
    const { ObjectId } = require('mongodb');
    
    const result = await collection.findOneAndDelete(
      { _id: new ObjectId(req.params.id) }
    );
    
    if (!result.value) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    console.log('✅ Branch deleted:', result.value.branchName);
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ message: 'Failed to delete branch', error: error.message });
  }
});

module.exports = router;