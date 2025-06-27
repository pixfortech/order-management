const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Changelog = require('../models/Changelog');
const jwt = require('jsonwebtoken');

// Authentication middleware (copied from server.js)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// In routes/changelog.js - enhance the /order/:orderId route
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const orderId = req.params.orderId;
    console.log('📋 Backend: Fetching changelog for order:', {
      orderId: orderId,
      orderIdType: typeof orderId,
      orderIdLength: orderId.length,
      isValidObjectId: /^[a-fA-F0-9]{24}$/.test(orderId),
      user: req.user.username,
      userRole: req.user.role
    });
    
    // Check if orderId is valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.error('❌ Invalid ObjectId format:', orderId);
      return res.status(400).json({ message: 'Invalid order ID format' });
    }
    
    const objectId = new mongoose.Types.ObjectId(orderId);
    console.log('📋 Converted to ObjectId:', objectId);
    
    // Try to find changelog entries
    const changelog = await Changelog.find({ orderId: objectId })
      .sort({ createdAt: -1 });
    
    console.log('📋 Database query result:', {
      foundEntries: changelog.length,
      entries: changelog.map(entry => ({
        id: entry._id,
        orderId: entry.orderId,
        orderNumber: entry.orderNumber,
        action: entry.action,
        createdAt: entry.createdAt
      }))
    });
    
    // Also try alternative queries to debug
    const allChangelogs = await Changelog.countDocuments();
    const changelogsByOrderNumber = await Changelog.find({ 
      orderNumber: { $regex: orderId, $options: 'i' } 
    });
    
    console.log('📋 Additional debug info:', {
      totalChangelogsInDB: allChangelogs,
      entriesFoundByOrderNumber: changelogsByOrderNumber.length
    });
    
    res.json(changelog);
  } catch (error) {
    console.error('❌ Error fetching changelog:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get changelog summary for multiple orders (admin only)
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { orderIds } = req.query;
    
    if (!orderIds) {
      return res.json({});
    }
    
    const orderIdArray = orderIds.split(',');
    console.log('📊 Fetching changelog summary for', orderIdArray.length, 'orders');
    
    const changelog = await Changelog.aggregate([
      { $match: { orderId: { $in: orderIdArray.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: '$orderId', count: { $sum: 1 } } }
    ]);
    
    const result = {};
    changelog.forEach(item => {
      result[item._id.toString()] = item.count;
    });
    
    console.log('✅ Changelog summary:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching changelog summary:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all changelog entries (admin only) - optional additional route
router.get('/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { page = 1, limit = 50 } = req.query;
    
    const changelog = await Changelog.find({})
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Changelog.countDocuments({});
    
    res.json({
      changelog,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Error fetching all changelog:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;