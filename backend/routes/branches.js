const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// Don't import Branch model directly - use mongoose.model() to avoid conflicts
// const Branch = require('../models/Branch'); // Remove this line

// Helper to get Branch model without import conflicts
const getBranchModel = () => {
  try {
    return mongoose.model('Branch');
  } catch (error) {
    // If model not registered, require it
    return require('../models/Branch');
  }
};

// Helper to get Order model without import conflicts
const getOrderModel = () => {
  try {
    return mongoose.model('Order');
  } catch (error) {
    // If model not registered, require it
    return require('../models/Order');
  }
};

// GET /api/branches - Get all branches from database
router.get('/', auth, async (req, res) => {
  try {
    const Branch = getBranchModel();
    const branches = await Branch.find({ isActive: { $ne: false } })
      .sort({ branchName: 1 })
      .select('branchName branchCode address phone email isActive');
    
    console.log(`✅ Found ${branches.length} active branches`);
    res.json(branches);
  } catch (error) {
    console.error('❌ Error fetching branches:', error);
    res.status(500).json({ message: 'Failed to fetch branches', error: error.message });
  }
});

// GET /api/branches/:branchCode - Get specific branch
router.get('/:branchCode', auth, async (req, res) => {
  try {
    const Branch = getBranchModel();
    const branchCode = req.params.branchCode.trim().toUpperCase();
    
    const branch = await Branch.findOne({ 
      branchCode: branchCode,
      isActive: { $ne: false }
    });
    
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    console.log(`✅ Found branch: ${branch.branchName}`);
    res.json(branch);
  } catch (error) {
    console.error('❌ Error fetching branch:', error);
    res.status(500).json({ message: 'Failed to fetch branch', error: error.message });
  }
});

// POST /api/branches - Create new branch (admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const Branch = getBranchModel();
    const { branchName, branchCode, address, phone, email } = req.body;
    
    // Validate required fields
    if (!branchName || !branchCode) {
      return res.status(400).json({ message: 'Branch name and code are required' });
    }
    
    // Validate branch code format
    if (branchCode.length > 3) {
      return res.status(400).json({ message: 'Branch code must be 3 characters or less' });
    }
    
    const branchData = {
      branchName: branchName.trim(),
      branchCode: branchCode.trim().toUpperCase(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      isActive: true
    };
    
    const branch = new Branch(branchData);
    const savedBranch = await branch.save();
    
    console.log(`✅ Branch created: ${savedBranch.branchName} (${savedBranch.branchCode})`);
    res.status(201).json(savedBranch);
    
  } catch (error) {
    console.error('❌ Error creating branch:', error);
    
    if (error.code === 11000) {
      // Handle duplicate key errors
      const field = Object.keys(error.keyPattern)[0];
      const message = field === 'branchCode' ? 
        'Branch code already exists' : 
        'Branch name already exists';
      res.status(400).json({ message });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Failed to create branch', error: error.message });
    }
  }
});

// PUT /api/branches/:id - Update branch (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const Branch = getBranchModel();
    const { branchName, branchCode, address, phone, email, isActive } = req.body;
    
    // Validate required fields
    if (!branchName || !branchCode) {
      return res.status(400).json({ message: 'Branch name and code are required' });
    }
    
    // Validate branch code format
    if (branchCode.length > 3) {
      return res.status(400).json({ message: 'Branch code must be 3 characters or less' });
    }
    
    const updateData = {
      branchName: branchName.trim(),
      branchCode: branchCode.trim().toUpperCase(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      isActive: isActive !== undefined ? isActive : true
    };
    
    const updatedBranch = await Branch.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedBranch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    console.log(`✅ Branch updated: ${updatedBranch.branchName} (${updatedBranch.branchCode})`);
    res.json(updatedBranch);
    
  } catch (error) {
    console.error('❌ Error updating branch:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = field === 'branchCode' ? 
        'Branch code already exists' : 
        'Branch name already exists';
      res.status(400).json({ message });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Failed to update branch', error: error.message });
    }
  }
});

// DELETE /api/branches/:id - Delete branch (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const Branch = getBranchModel();
    const branch = await Branch.findById(req.params.id);
    
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    // Soft delete - set isActive to false instead of removing
    const deletedBranch = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    console.log(`✅ Branch deactivated: ${deletedBranch.branchName} (${deletedBranch.branchCode})`);
    res.json({ message: 'Branch deactivated successfully', branch: deletedBranch });
    
  } catch (error) {
    console.error('❌ Error deleting branch:', error);
    res.status(500).json({ message: 'Failed to delete branch', error: error.message });
  }
});

// POST /api/branches/:branchCode/orders - Create order for specific branch
router.post('/:branchCode/orders', auth, async (req, res) => {
  try {
    const { branchCode } = req.params;
    const orderData = req.body;
    
    const Branch = getBranchModel();
    const Order = getOrderModel();
    
    // Validate branch exists
    const branch = await Branch.findOne({ 
      branchCode: branchCode.toUpperCase(),
      isActive: { $ne: false }
    });
    
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    // Validate and prepare order data
    const finalOrderData = {
      ...orderData,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      advancePaid: Number(orderData.advancePaid) || 0,
      balancePaid: Number(orderData.balancePaid) || 0,
      grandTotal: Number(orderData.grandTotal) || 0,
      advancePaidDate: orderData.advancePaidDate || null,
      balancePaidDate: orderData.balancePaidDate || null
    };
    
    // Calculate balance
    finalOrderData.balance = Math.max(0, 
      finalOrderData.grandTotal - finalOrderData.advancePaid - finalOrderData.balancePaid
    );
    
    console.log('📝 Creating order for branch:', branch.branchName, 'with payment data:', {
      advancePaid: finalOrderData.advancePaid,
      balancePaid: finalOrderData.balancePaid,
      grandTotal: finalOrderData.grandTotal,
      balance: finalOrderData.balance
    });
    
    const order = new Order(finalOrderData);
    const savedOrder = await order.save();
    
    console.log('✅ Order created:', savedOrder._id);
    res.status(201).json(savedOrder);
    
  } catch (error) {
    console.error('❌ Error creating order:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Failed to create order', error: error.message });
    }
  }
});

// PUT /api/branches/:branchCode/orders/:id - Update order for specific branch
router.put('/:branchCode/orders/:id', auth, async (req, res) => {
  try {
    const { branchCode, id } = req.params;
    const updateData = req.body;
    
    const Branch = getBranchModel();
    const Order = getOrderModel();
    
    // Validate branch exists
    const branch = await Branch.findOne({ 
      branchCode: branchCode.toUpperCase(),
      isActive: { $ne: false }
    });
    
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    // Prepare update data with proper payment handling
    const finalUpdateData = {
      ...updateData,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      advancePaid: Number(updateData.advancePaid) || 0,
      balancePaid: Number(updateData.balancePaid) || 0,
      grandTotal: Number(updateData.grandTotal) || 0,
      advancePaidDate: updateData.advancePaidDate || null,
      balancePaidDate: updateData.balancePaidDate || null
    };
    
    // Calculate balance
    finalUpdateData.balance = Math.max(0, 
      finalUpdateData.grandTotal - finalUpdateData.advancePaid - finalUpdateData.balancePaid
    );
    
    console.log('🔄 Updating order:', id, 'for branch:', branch.branchName, 'with payment data:', {
      advancePaid: finalUpdateData.advancePaid,
      balancePaid: finalUpdateData.balancePaid,
      grandTotal: finalUpdateData.grandTotal,
      balance: finalUpdateData.balance
    });
    
    const updatedOrder = await Order.findByIdAndUpdate(
      id, 
      finalUpdateData, 
      { new: true, runValidators: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    console.log('✅ Order updated:', updatedOrder._id);
    res.json(updatedOrder);
    
  } catch (error) {
    console.error('❌ Error updating order:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Failed to update order', error: error.message });
    }
  }
});

// GET /api/branches/:branchCode/stats - Get branch statistics
router.get('/:branchCode/stats', auth, async (req, res) => {
  try {
    const { branchCode } = req.params;
    
    const Branch = getBranchModel();
    const Order = getOrderModel();
    
    // Validate branch exists
    const branch = await Branch.findOne({ 
      branchCode: branchCode.toUpperCase(),
      isActive: { $ne: false }
    });
    
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    // Get branch statistics using native MongoDB operations
    const db = mongoose.connection.db;
    
    // Get customer count
    let customerCount = 0;
    try {
      const customerCollection = db.collection(`customers_${branchCode.toLowerCase()}`);
      customerCount = await customerCollection.countDocuments();
    } catch (error) {
      console.warn(`Customer collection for ${branchCode} not found`);
    }
    
    // Get order statistics
    const orderStats = await Order.aggregate([
      { $match: { branchCode: branch.branchCode } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' },
          totalAdvancePaid: { $sum: '$advancePaid' },
          totalBalancePaid: { $sum: '$balancePaid' },
          pendingBalance: { $sum: '$balance' }
        }
      }
    ]);
    
    const stats = orderStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalAdvancePaid: 0,
      totalBalancePaid: 0,
      pendingBalance: 0
    };
    
    const branchStats = {
      branch: {
        name: branch.branchName,
        code: branch.branchCode
      },
      customers: customerCount,
      orders: stats.totalOrders,
      revenue: {
        total: stats.totalRevenue,
        advancePaid: stats.totalAdvancePaid,
        balancePaid: stats.totalBalancePaid,
        pending: stats.pendingBalance
      }
    };
    
    console.log(`✅ Branch stats for ${branch.branchName}:`, branchStats);
    res.json(branchStats);
    
  } catch (error) {
    console.error('❌ Error fetching branch stats:', error);
    res.status(500).json({ message: 'Failed to fetch branch statistics', error: error.message });
  }
});

module.exports = router;