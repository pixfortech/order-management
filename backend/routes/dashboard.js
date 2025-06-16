const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const { getOrderModel } = require('../utils/dynamicCollections');

// GET /api/dashboard/metrics
router.get('/metrics', auth, async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const user = req.user;
    
    console.log('📊 Dashboard metrics request:', {
      user: user.username,
      role: user.role,
      branchCode: user.branchCode,
      filter,
      startDate,
      endDate
    });
    
    // Build date filter
    let dateFilter = {};
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { orderDate: { $gte: today.toISOString().split('T')[0], $lt: tomorrow.toISOString().split('T')[0] } };
    } else if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { orderDate: { $gte: weekAgo.toISOString().split('T')[0] } };
    } else if (filter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { orderDate: { $gte: monthAgo.toISOString().split('T')[0] } };
    } else if (filter === 'custom' && startDate && endDate) {
      dateFilter = { 
        orderDate: { 
          $gte: startDate, 
          $lte: endDate 
        } 
      };
    }
    
    // Exclude drafts from metrics
    dateFilter.isDraft = { $ne: true };
    
    console.log('🔍 Using date filter:', dateFilter);
    
    let totalOrders = 0;
    let totalBoxes = 0;
    let totalCustomers = 0;
    let totalRevenue = 0;
    
    if (user.role === 'admin') {
      // Admin: Get metrics from all branches
      console.log('👑 Admin user - fetching metrics from all branches');
      
      const branchesCollection = mongoose.connection.db.collection('branches');
      const branches = await branchesCollection.find({}).toArray();
      
      console.log(`📋 Found ${branches.length} branches`);
      
      for (const branch of branches) {
        try {
          const OrderModel = getOrderModel(branch.branchCode.toLowerCase());
          
          // Count orders
          const branchOrderCount = await OrderModel.countDocuments(dateFilter);
          totalOrders += branchOrderCount;
          
          // Sum total boxes
          const boxesResult = await OrderModel.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$totalBoxCount" } } }
          ]);
          const branchBoxes = boxesResult[0]?.total || 0;
          totalBoxes += branchBoxes;
          
          // Count unique customers
          const uniqueCustomers = await OrderModel.distinct('customerName', dateFilter);
          totalCustomers += uniqueCustomers.length;
          
          // Sum revenue
          const revenueResult = await OrderModel.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } }
          ]);
          const branchRevenue = revenueResult[0]?.total || 0;
          totalRevenue += branchRevenue;
          
          console.log(`📊 Branch ${branch.branchCode}: Orders=${branchOrderCount}, Boxes=${branchBoxes}, Customers=${uniqueCustomers.length}, Revenue=${branchRevenue}`);
          
        } catch (error) {
          console.warn(`⚠️ Error processing branch ${branch.branchCode}:`, error.message);
        }
      }
    } else {
      // Regular user: Get metrics from their branch only
      console.log(`👤 Regular user - fetching metrics from branch: ${user.branchCode}`);
      
      if (!user.branchCode) {
        return res.status(400).json({ error: 'User has no assigned branch code' });
      }
      
      const OrderModel = getOrderModel(user.branchCode.toLowerCase());
      
      // Count orders
      totalOrders = await OrderModel.countDocuments(dateFilter);
      
      // Sum total boxes
      const boxesResult = await OrderModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: "$totalBoxCount" } } }
      ]);
      totalBoxes = boxesResult[0]?.total || 0;
      
      // Count unique customers
      const uniqueCustomers = await OrderModel.distinct('customerName', dateFilter);
      totalCustomers = uniqueCustomers.length;
      
      // Sum revenue
      const revenueResult = await OrderModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]);
      totalRevenue = revenueResult[0]?.total || 0;
      
      console.log(`📊 User branch metrics: Orders=${totalOrders}, Boxes=${totalBoxes}, Customers=${totalCustomers}, Revenue=${totalRevenue}`);
    }
    
    const metrics = {
      totalOrders,
      totalBoxes,
      totalCustomers,
      totalRevenue
    };
    
    console.log('✅ Final dashboard metrics:', metrics);
    
    res.json(metrics);
    
  } catch (error) {
    console.error('❌ Dashboard metrics error:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Failed to fetch dashboard metrics'
    });
  }
});

// GET /api/dashboard/stats - Additional stats endpoint
router.get('/stats', auth, async (req, res) => {
  try {
    const user = req.user;
    
    let recentOrders = [];
    let topCustomers = [];
    
    if (user.role === 'admin') {
      // Admin: Get stats from all branches
      const branchesCollection = mongoose.connection.db.collection('branches');
      const branches = await branchesCollection.find({}).toArray();
      
      for (const branch of branches) {
        try {
          const OrderModel = getOrderModel(branch.branchCode.toLowerCase());
          
          // Get recent orders
          const branchRecentOrders = await OrderModel.find({ isDraft: { $ne: true } })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
          
          // Add branch info
          branchRecentOrders.forEach(order => {
            order.branchCode = branch.branchCode;
            order.branchName = branch.branchName;
          });
          
          recentOrders.push(...branchRecentOrders);
          
        } catch (error) {
          console.warn(`⚠️ Error getting stats from branch ${branch.branchCode}:`, error.message);
        }
      }
      
      // Sort and limit recent orders
      recentOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      recentOrders = recentOrders.slice(0, 10);
      
    } else {
      // Regular user: Get stats from their branch
      const OrderModel = getOrderModel(user.branchCode.toLowerCase());
      
      recentOrders = await OrderModel.find({ isDraft: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      // Add branch info
      recentOrders.forEach(order => {
        order.branchCode = user.branchCode;
      });
    }
    
    res.json({
      recentOrders,
      topCustomers
    });
    
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

module.exports = router;