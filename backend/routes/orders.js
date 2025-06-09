const express = require('express');
const mongoose = require('mongoose');
const { auth, adminOnly } = require('../middleware/auth');
const { getOrderModel, getCustomerModel } = require('../utils/dynamicCollections');

const router = express.Router();

// @route   GET /api/orders/all
// @desc    Get all orders from all branches (admin only)
// @access  Private (Admin)
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { page = 1, limit = 50, status, search, startDate, endDate, occasion } = req.query;
    
    console.log('🔍 Admin fetching all orders with filters:', { status, search, startDate, endDate, occasion });
    
    // Get all available branch codes from your branches collection
    const branchesCollection = mongoose.connection.db.collection('branches');
    const branches = await branchesCollection.find({}).toArray();
    
    const allOrders = [];
    
    // Fetch orders from each branch
    for (const branch of branches) {
      try {
        const OrderModel = getOrderModel(branch.branchCode.toLowerCase());
        let query = {};
        
        // Apply filters
        if (status) query.status = status;
        if (occasion) query.occasion = occasion;
        if (startDate || endDate) {
          query.orderDate = {};
          if (startDate) query.orderDate.$gte = startDate;
          if (endDate) query.orderDate.$lte = endDate;
        }
        if (search) {
          query.$or = [
            { customerName: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { orderNumber: { $regex: search, $options: 'i' } }
          ];
        }
        
        const orders = await OrderModel.find(query)
          .sort({ createdAt: -1 })
          .lean();
        
        // Add branch info to each order
        orders.forEach(order => {
          order.branchCode = branch.branchCode;
          order.branchName = branch.branchName;
        });
        
        allOrders.push(...orders);
      } catch (error) {
        console.warn(`Failed to fetch orders from branch ${branch.branchCode}:`, error.message);
      }
    }
    
    // Sort all orders by creation date
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = allOrders.slice(startIndex, endIndex);
    
    console.log(`📊 Found ${allOrders.length} total orders, returning ${paginatedOrders.length}`);
    
    res.json({
      orders: paginatedOrders,
      totalPages: Math.ceil(allOrders.length / limit),
      currentPage: parseInt(page),
      total: allOrders.length
    });
  } catch (error) {
    console.error('❌ Get all orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/orders/last-number/:prefix
// @desc    Get last order number for prefix
// @access  Private
router.get('/last-number/:prefix', auth, async (req, res) => {
  try {
    const { prefix } = req.params;
    const branchCode = prefix.split('-')[0].toLowerCase();
    
    console.log('🔍 Getting last number for prefix:', prefix, 'Branch:', branchCode);
    
    const OrderModel = getOrderModel(branchCode);
    const lastOrder = await OrderModel
      .findOne({ orderNumber: new RegExp(`^${prefix}-`) })
      .sort({ orderNumber: -1 });
    
    const lastNumber = lastOrder 
      ? parseInt(lastOrder.orderNumber.split('-').pop())
      : 0;
    
    console.log('📊 Last number found:', lastNumber);
    res.json({ lastNumber });
  } catch (error) {
    console.error('Get last order number error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/check-number
// @desc    Check if order number exists
// @access  Private
router.get('/check-number', auth, async (req, res) => {
  try {
    const { orderNumber } = req.query;
    
    if (!orderNumber) {
      return res.status(400).json({ message: 'Order number is required' });
    }
    
    const branchCode = orderNumber.split('-')[0].toLowerCase();
    const OrderModel = getOrderModel(branchCode);
    
    const existingOrder = await OrderModel.findOne({ orderNumber });
    
    res.json({ exists: !!existingOrder });
  } catch (error) {
    console.error('Check order number error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/:branchCode
// @desc    Get orders from specific branch
// @access  Private
router.get('/:branchCode', auth, async (req, res) => {
  try {
    const { branchCode } = req.params;
    const { page = 1, limit = 50, status, search, startDate, endDate, occasion } = req.query;
    
    console.log(`🔍 Fetching orders from branch: ${branchCode}`);
    
    // Ensure user can access this branch (unless admin)
    if (req.user.role !== 'admin' && req.user.branchCode !== branchCode.toUpperCase()) {
      return res.status(403).json({ message: 'Cannot view orders from other branches' });
    }
    
    const OrderModel = getOrderModel(branchCode.toLowerCase());
    let query = {};
    
    // Apply filters
    if (status) query.status = status;
    if (occasion) query.occasion = occasion;
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = startDate;
      if (endDate) query.orderDate.$lte = endDate;
    }
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const orders = await OrderModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await OrderModel.countDocuments(query);
    
    // Add branch info to orders
    orders.forEach(order => {
      order.branchCode = branchCode.toUpperCase();
    });
    
    console.log(`📊 Found ${total} orders in branch ${branchCode}, returning ${orders.length}`);
    
    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Get branch orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/orders/:branchCode/:orderId
// @desc    Get specific order
// @access  Private
router.get('/:branchCode/:orderId', auth, async (req, res) => {
  try {
    const { branchCode, orderId } = req.params;
    
    console.log(`🔍 Getting specific order: ${orderId} from branch: ${branchCode}`);
    
    // Ensure user can only view orders from their branch (unless admin)
    if (req.user.role !== 'admin' && req.user.branchCode !== branchCode.toUpperCase()) {
      return res.status(403).json({ message: 'Cannot view orders from other branches' });
    }
    
    const OrderModel = getOrderModel(branchCode.toLowerCase());
    const order = await OrderModel.findById(orderId).lean();
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Add branch info
    order.branchCode = branchCode.toUpperCase();
    
    res.json(order);
  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/orders/:branchCode
// @desc    Save order to branch-specific collection
// @access  Private
router.post('/:branchCode', auth, async (req, res) => {
  try {
    const { branchCode } = req.params;
    
    console.log('🔍 === BRANCH CODE DEBUG ===');
    console.log('📍 URL branchCode param:', branchCode);
    console.log('👤 User branchCode:', req.user.branchCode);
    console.log('👤 User role:', req.user.role);
    console.log('📊 Request body branchCode:', req.body.branchCode);
    console.log('🔍 === END DEBUG ===');
    
    // ✅ FIXED: Consistent case handling for collections
    const normalizedBranchCode = branchCode.toLowerCase();
    console.log('📦 Using normalized branch code for collections:', normalizedBranchCode);
    
    const OrderModel = getOrderModel(normalizedBranchCode);
    const CustomerModel = getCustomerModel(normalizedBranchCode);
    
    // ✅ FIXED: Use uppercase for comparison (user data is stored in uppercase)
    const urlBranchCode = branchCode.toUpperCase();
    const userBranchCode = req.user.branchCode ? req.user.branchCode.toUpperCase() : '';
    
    console.log('🔄 Comparison (both uppercase):');
    console.log('📍 URL branch code:', urlBranchCode);
    console.log('👤 User branch code:', userBranchCode);
    
    // Branch access validation
    if (req.user.role !== 'admin') {
      if (!userBranchCode) {
        return res.status(403).json({ message: 'User has no assigned branch code' });
      }
      
      if (userBranchCode !== urlBranchCode) {
        console.log('❌ Branch mismatch');
        return res.status(403).json({ 
          message: `Cannot save orders to other branches. User: ${userBranchCode}, Requested: ${urlBranchCode}` 
        });
      }
    }
    
    // Validate required fields
    if (!req.body.orderNumber) {
      return res.status(400).json({ message: 'Order number is required' });
    }
    
    if (!req.body.customerName || !req.body.phone) {
      return res.status(400).json({ message: 'Customer name and phone are required' });
    }
    
    // Create/Update customer record
    const customerData = {
      name: req.body.customerName,
      phone: req.body.phone,
      email: req.body.email || '',
      address: req.body.address || '',
      pincode: req.body.pincode || '',
      city: req.body.city || '',
      state: req.body.state || '',
      branch: req.body.branch,
      branchCode: urlBranchCode,
      lastOrderDate: new Date()
    };

    console.log('👤 Creating/updating customer with data:', {
      phone: customerData.phone,
      branchCode: customerData.branchCode
    });

    await CustomerModel.findOneAndUpdate(
      { phone: req.body.phone, branchCode: urlBranchCode },
      {
        ...customerData,
        $inc: { totalOrders: 1, totalSpent: req.body.grandTotal || 0 }
      },
      { upsert: true, new: true }
    );
    
    // Check for duplicate order number
    const existingOrder = await OrderModel.findOne({ orderNumber: req.body.orderNumber });
    if (existingOrder) {
      return res.status(409).json({ message: 'Order number already exists in this branch' });
    }
    
    // Create order
    const orderData = {
      ...req.body,
      branch: req.body.branch,
      branchCode: urlBranchCode,
      createdBy: req.user.username || req.user._id
    };
    
    console.log('📋 Creating order with data:', {
      orderNumber: orderData.orderNumber,
      branchCode: orderData.branchCode,
      branch: orderData.branch
    });
    
    const order = new OrderModel(orderData);
    await order.save();
    
    console.log('✅ Order saved successfully:', order.orderNumber);
    
    res.status(201).json({
      message: 'Order saved successfully',
      order
    });
  } catch (error) {
    console.error('❌ Save order error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: error.message 
      });
    }
    
    if (error.name === 'BSONError') {
      return res.status(400).json({ 
        message: 'Invalid data format - possible ObjectId issue', 
        details: error.message 
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'Duplicate order number',
        details: 'Order number already exists' 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/orders/:branchCode/:orderId
// @desc    Update existing order
// @access  Private
router.put('/:branchCode/:orderId', auth, async (req, res) => {
  try {
    const { branchCode, orderId } = req.params;
    
    console.log(`🔄 Updating order: ${orderId} in branch: ${branchCode}`);
    
    // Ensure user can only update orders from their branch (unless admin)
    if (req.user.role !== 'admin' && req.user.branchCode !== branchCode.toUpperCase()) {
      return res.status(403).json({ message: 'Cannot update orders from other branches' });
    }
    
    const OrderModel = getOrderModel(branchCode.toLowerCase());
    
    const order = await OrderModel.findByIdAndUpdate(
      orderId,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    console.log('✅ Order updated successfully:', order.orderNumber);
    
    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('❌ Update order error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: error.message 
      });
    }
    
    if (error.name === 'BSONError') {
      return res.status(400).json({ 
        message: 'Invalid data format', 
        details: error.message 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/orders/:branchCode/:orderId
// @desc    Delete order (admin only)
// @access  Private (Admin)
router.delete('/:branchCode/:orderId', auth, adminOnly, async (req, res) => {
  try {
    const { branchCode, orderId } = req.params;
    
    console.log(`🗑️ Admin deleting order: ${orderId} from branch: ${branchCode}`);
    
    const OrderModel = getOrderModel(branchCode.toLowerCase());
    
    const order = await OrderModel.findByIdAndDelete(orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    console.log('✅ Order deleted successfully:', order.orderNumber);
    
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/orders
// @desc    Get orders for current user's branch (fallback route)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    
    console.log('📋 Fallback route - getting orders for user branch:', req.user.branchCode);
    
    if (!req.user.branchCode) {
      return res.status(400).json({ message: 'User has no assigned branch code' });
    }
    
    const OrderModel = getOrderModel(req.user.branchCode.toLowerCase());
    let query = {};
    
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const orders = await OrderModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await OrderModel.countDocuments(query);
    
    // Add branch info to orders
    orders.forEach(order => {
      order.branchCode = req.user.branchCode;
    });
    
    console.log(`📊 Found ${total} orders in user branch, returning ${orders.length}`);
    
    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;