const express = require('express');
const { auth, adminOnly } = require('../middleware/auth');
const { getOrderModel, getCustomerModel } = require('../utils/dynamicCollections');
//const Branch = require('../models/Branch');

const router = express.Router();

// @route   POST /api/orders/:branchCode
// @desc    Save order to branch-specific collection
// @access  Private
router.post('/:branchCode', auth, async (req, res) => {
  try {
    const { branchCode } = req.params;
    const OrderModel = getOrderModel(branchCode);
    const CustomerModel = getCustomerModel(branchCode);
    
    // Ensure user can only save to their branch (unless admin)
    if (req.user.role !== 'admin' && req.user.branchCode !== branchCode.toUpperCase()) {
      return res.status(403).json({ message: 'Cannot save orders to other branches' });
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
      branchCode: req.body.branchCode,
      lastOrderDate: new Date()
    };

    await CustomerModel.findOneAndUpdate(
      { phone: req.body.phone, branchCode: req.body.branchCode },
      {
        ...customerData,
        $inc: { totalOrders: 1, totalSpent: req.body.grandTotal }
      },
      { upsert: true, new: true }
    );
    
    // Create order
    const order = new OrderModel(req.body);
    await order.save();
    
    res.status(201).json({
      message: 'Order saved successfully',
      order
    });
  } catch (error) {
    console.error('Save order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/orders/:branchCode/:orderId
// @desc    Update existing order
// @access  Private
router.put('/:branchCode/:orderId', auth, async (req, res) => {
  try {
    const { branchCode, orderId } = req.params;
    const OrderModel = getOrderModel(branchCode);
    
    // Ensure user can only update orders from their branch (unless admin)
    if (req.user.role !== 'admin' && req.user.branchCode !== branchCode.toUpperCase()) {
      return res.status(403).json({ message: 'Cannot update orders from other branches' });
    }
    
    const order = await OrderModel.findByIdAndUpdate(
      orderId,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/orders
// @desc    Get orders (branch-specific or all for admin)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    
    if (req.user.role === 'admin') {
      // Admin can see all branches
      const branches = await Branch.find({ isActive: true });
      const allOrders = [];
      
      for (const branch of branches) {
        const OrderModel = getOrderModel(branch.branchCode);
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
          .skip((page - 1) * limit);
        
        allOrders.push(...orders);
      }
      
      // Sort all orders by creation date
      allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      res.json({
        orders: allOrders.slice(0, limit),
        totalPages: Math.ceil(allOrders.length / limit),
        currentPage: page
      });
    } else {
      // Regular users see only their branch
      const OrderModel = getOrderModel(req.user.branchCode);
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
        .skip((page - 1) * limit);
      
      const total = await OrderModel.countDocuments(query);
      
      res.json({
        orders,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      });
    }
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/:branchCode/:orderId
// @desc    Get specific order
// @access  Private
router.get('/:branchCode/:orderId', auth, async (req, res) => {
  try {
    const { branchCode, orderId } = req.params;
    const OrderModel = getOrderModel(branchCode);
    
    // Ensure user can only view orders from their branch (unless admin)
    if (req.user.role !== 'admin' && req.user.branchCode !== branchCode.toUpperCase()) {
      return res.status(403).json({ message: 'Cannot view orders from other branches' });
    }
    
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/last-number/:prefix
// @desc    Get last order number for prefix
// @access  Private
router.get('/last-number/:prefix', auth, async (req, res) => {
  try {
    const { prefix } = req.params;
    const branchCode = prefix.split('-')[0].toLowerCase();
    
    const OrderModel = getOrderModel(branchCode);
    const lastOrder = await OrderModel
      .findOne({ orderNumber: new RegExp(`^${prefix}-`) })
      .sort({ orderNumber: -1 });
    
    const lastNumber = lastOrder 
      ? parseInt(lastOrder.orderNumber.split('-').pop())
      : 0;
    
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

// @route   DELETE /api/orders/:branchCode/:orderId
// @desc    Delete order (admin only)
// @access  Private (Admin)
router.delete('/:branchCode/:orderId', auth, adminOnly, async (req, res) => {
  try {
    const { branchCode, orderId } = req.params;
    const OrderModel = getOrderModel(branchCode);
    
    const order = await OrderModel.findByIdAndDelete(orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;