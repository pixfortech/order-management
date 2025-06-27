// routes/orders.js - Fixed with correct utils path
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// ✅ FIXED: Import from the correct utils path (based on deployment structure)
const { createChangelogEntry, generateChanges } = require('../utils/changelog'); 

// Import models
const Order = require('../models/Order');

// Helper to get Branch model without import conflicts
const getBranchModel = () => {
  try {
    return mongoose.model('Branch');
  } catch (error) {
    return require('../models/Branch');
  }
};

// ===== ORDER COLLECTION MANAGEMENT =====

/**
 * Get all order collection names in the database
 * Handles both main 'orders' collection and branch-specific collections like 'orders_bd'
 */
async function getOrderCollectionNames() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    return collections
      .filter(c => c.name === 'orders' || c.name.startsWith('orders_'))
      .map(c => c.name)
      .sort(); // Sort for consistency
  } catch (error) {
    console.error('❌ Error getting order collections:', error);
    return ['orders']; // Fallback to main collection
  }
}

/**
 * Get appropriate order collection name for a branch
 */
function getOrderCollectionForBranch(branchCode) {
  if (!branchCode) return 'orders';
  return `orders_${branchCode.toLowerCase()}`;
}

/**
 * Fetch orders from multiple collections with proper filtering
 */
async function fetchOrdersFromCollections(user, filters = {}) {
  const db = mongoose.connection.db;
  const isAdmin = user.role === 'admin';
  let collectionsToSearch = [];
  
  if (isAdmin) {
    if (filters.branch) {
      // Admin filtering by specific branch
      const targetCollection = getOrderCollectionForBranch(filters.branch);
      collectionsToSearch = [targetCollection];
    } else {
      // Admin viewing all branches
      collectionsToSearch = await getOrderCollectionNames();
    }
  } else {
    // Non-admin users - only their branch
    const userBranchCode = user.branchCode || user.branch;
    if (userBranchCode) {
      collectionsToSearch = [getOrderCollectionForBranch(userBranchCode)];
    } else {
      console.warn('⚠️ User has no branch assigned:', user.username);
      return [];
    }
  }
  
  console.log('🔍 Searching in collections:', collectionsToSearch);
  
  let allOrders = [];
  
  for (const collectionName of collectionsToSearch) {
    try {
      const collection = db.collection(collectionName);
      
      // Build query based on filters
      const query = {};
      
      if (filters.customerName) {
        query.customerName = new RegExp(filters.customerName, 'i');
      }
      if (filters.phone) {
        query.phone = new RegExp(filters.phone);
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.orderDate) {
        const date = new Date(filters.orderDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        query.orderDate = { $gte: date, $lt: nextDay };
      }
      if (filters.deliveryDate) {
        const date = new Date(filters.deliveryDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        query.deliveryDate = { $gte: date, $lt: nextDay };
      }
      
      console.log(`📊 Querying ${collectionName} with:`, query);
      
      const orders = await collection.find(query).toArray();
      
      // Add collection info to each order for tracking
      const ordersWithSource = orders.map(order => ({
        ...order,
        _sourceCollection: collectionName,
        branchCode: order.branchCode || collectionName.replace('orders_', '').toUpperCase()
      }));
      
      allOrders = allOrders.concat(ordersWithSource);
      console.log(`✅ Found ${orders.length} orders in ${collectionName}`);
      
    } catch (error) {
      console.warn(`⚠️ Could not search ${collectionName}:`, error.message);
    }
  }
  
  // Sort by creation date (newest first)
  allOrders.sort((a, b) => {
    const dateA = new Date(a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.createdAt || b.orderDate || 0);
    return dateB - dateA;
  });
  
  console.log(`✅ Total orders found: ${allOrders.length}`);
  return allOrders;
}

// ===== API ROUTES =====

// GET /api/orders/all - Get all orders
router.get('/all', auth, async (req, res) => {
  try {
    console.log('📋 GET /api/orders/all called');
    console.log('👤 User:', req.user.username, 'Role:', req.user.role, 'Branch:', req.user.branchCode || req.user.branch);
    
    const filters = {
      branch: req.query.branch,
      customerName: req.query.name,
      phone: req.query.phone,
      status: req.query.status,
      orderDate: req.query.orderDate,
      deliveryDate: req.query.deliveryDate
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (!filters[key] || filters[key].trim() === '') {
        delete filters[key];
      }
    });
    
    console.log('🔍 Applied filters:', filters);
    
    const orders = await fetchOrdersFromCollections(req.user, filters);
    
    // Limit response size for performance
    const limitedOrders = orders.slice(0, parseInt(req.query.limit) || 100);
    
    console.log(`📊 Returning ${limitedOrders.length} orders`);
    res.json(limitedOrders);
    
  } catch (error) {
    console.error('❌ Error in /all route:', error);
    res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// GET /api/orders/:branchCode - Get orders for specific branch
router.get('/:branchCode', auth, async (req, res) => {
  try {
    const { branchCode } = req.params;
    console.log(`📋 GET /api/orders/${branchCode} called`);
    
    // Validate it's a branch code (2-3 characters, not ObjectId)
    if (branchCode.length <= 3 && /^[A-Za-z]+$/i.test(branchCode)) {
      const user = req.user;
      
      // Check permissions for non-admin users
      if (user.role !== 'admin') {
        const userBranchCode = (user.branchCode || user.branch || '').toLowerCase();
        if (branchCode.toLowerCase() !== userBranchCode) {
          return res.status(403).json({ 
            message: 'Access denied. You can only view orders from your own branch.' 
          });
        }
      }
      
      const collectionName = getOrderCollectionForBranch(branchCode);
      console.log(`📊 Fetching from collection: ${collectionName}`);
      
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);
      
      const orders = await collection.find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      
      // Add branch code to orders if missing
      const ordersWithBranch = orders.map(order => ({
        ...order,
        branchCode: order.branchCode || branchCode.toUpperCase(),
        _sourceCollection: collectionName
      }));
      
      console.log(`✅ Found ${orders.length} orders for branch ${branchCode}`);
      res.json(ordersWithBranch);
      
    } else {
      // If it's not a branch code, try as ObjectId
      if (!mongoose.Types.ObjectId.isValid(branchCode)) {
        return res.status(400).json({ 
          message: 'Invalid order ID or branch code format' 
        });
      }
      
      // Try to find order across all collections
      const orders = await fetchOrdersFromCollections(req.user);
      const order = orders.find(o => o._id.toString() === branchCode);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      console.log('✅ Order found:', order.orderNumber);
      res.json(order);
    }
    
  } catch (error) {
    console.error('❌ Error in /:branchCode route:', error);
    res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// GET /api/orders - Default route (fallback to /all behavior)
router.get('/', auth, async (req, res) => {
  try {
    console.log('📋 GET /api/orders (default) called');
    
    const orders = await fetchOrdersFromCollections(req.user);
    const limitedOrders = orders.slice(0, 50);
    
    console.log(`✅ Found ${limitedOrders.length} orders`);
    res.json(limitedOrders);
    
  } catch (error) {
    console.error('❌ Error in default route:', error);
    res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// POST /api/orders - Create new order (UPDATED with changelog)
router.post('/', auth, async (req, res) => {
  try {
    console.log('📝 Creating new order...');
    const orderData = req.body;
    const user = req.user;
    
    // Validate required fields
    if (!orderData.customerName || !orderData.phone) {
      return res.status(400).json({ 
        message: 'Customer name and phone are required' 
      });
    }
    
    // Determine target branch
    let targetBranchCode;
    if (orderData.branchCode) {
      targetBranchCode = orderData.branchCode.toUpperCase();
    } else if (user.branchCode) {
      targetBranchCode = user.branchCode.toUpperCase();
    } else if (user.branch) {
      targetBranchCode = user.branch.toUpperCase();
    } else {
      return res.status(400).json({ message: 'Branch information is required' });
    }
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = (user.branchCode || user.branch || '').toUpperCase();
      if (targetBranchCode !== userBranchCode) {
        return res.status(403).json({ 
          message: 'You can only create orders for your own branch' 
        });
      }
    }
    
    // Get branch information
    const Branch = getBranchModel();
    const branch = await Branch.findOne({ branchCode: targetBranchCode });
    
    // Prepare order data
    const finalOrderData = {
      ...orderData,
      branchCode: targetBranchCode,
      branchName: branch ? branch.branchName : orderData.branchName,
      createdBy: user.username || user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Generate order number if not provided
    if (!finalOrderData.orderNumber) {
      const collectionName = getOrderCollectionForBranch(targetBranchCode);
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);
      
      // Get last order number for this branch
      const lastOrder = await collection.findOne(
        { branchCode: targetBranchCode },
        { sort: { createdAt: -1 } }
      );
      
      let nextNumber = 1;
      if (lastOrder && lastOrder.orderNumber) {
        const match = lastOrder.orderNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      finalOrderData.orderNumber = `${targetBranchCode}-${String(nextNumber).padStart(4, '0')}`;
    }
    
    // Save to appropriate collection
    const collectionName = getOrderCollectionForBranch(targetBranchCode);
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    const result = await collection.insertOne(finalOrderData);
    
    const savedOrder = {
      _id: result.insertedId,
      ...finalOrderData
    };
    
    // ✅ CREATE CHANGELOG ENTRY FOR NEW ORDER
    try {
      await createChangelogEntry(
        savedOrder._id,
        savedOrder.orderNumber,
        'created',
        [], // No changes for new order
        user,
        req
      );
      console.log('📝 Changelog entry created for new order:', savedOrder.orderNumber);
    } catch (changelogError) {
      console.error('❌ Failed to create changelog entry:', changelogError);
      // Don't fail the order creation if changelog fails
    }
    
    console.log('✅ Order created:', savedOrder.orderNumber, 'in collection:', collectionName);
    res.status(201).json(savedOrder);
    
  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({ 
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// PUT /api/orders/:branchCode/:id - Update order (UPDATED with changelog)
router.put('/:branchCode/:id', auth, async (req, res) => {
  try {
    const { branchCode, id } = req.params;
    const updateData = req.body;
    const user = req.user;
    
    console.log(`🔄 Updating order ${id} in branch ${branchCode}`);
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = (user.branchCode || user.branch || '').toLowerCase();
      if (branchCode.toLowerCase() !== userBranchCode) {
        return res.status(403).json({ 
          message: 'You can only update orders from your own branch' 
        });
      }
    }
    
    const collectionName = getOrderCollectionForBranch(branchCode);
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    // Get the old order data BEFORE updating (for changelog)
    const oldOrder = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!oldOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Prepare update data
    const finalUpdateData = {
      ...updateData,
      updatedBy: user.username || user.id,
      updatedAt: new Date()
    };
    
    // Remove system fields that shouldn't be updated
    const { _id: removeId, createdAt, __v, ...cleanUpdateData } = finalUpdateData;
    
    const result = await collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: cleanUpdateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ message: 'Order not found after update' });
    }
    
    // ✅ GENERATE CHANGES AND CREATE CHANGELOG ENTRY
    try {
      const changes = generateChanges(oldOrder, result.value);
      
      // Only create changelog entry if there are actual changes
      if (changes.length > 0) {
        let action = 'updated';
        
        // Determine specific action type based on what changed
        if (changes.some(c => c.field === 'status')) {
          action = 'status_changed';
        } else if (changes.some(c => c.field === 'orderProgress')) {
          action = 'progress_updated';
        } else if (changes.some(c => c.field === 'advancePaid' || c.field === 'balancePaid')) {
          action = 'payment_added';
        }
        
        await createChangelogEntry(
          result.value._id,
          result.value.orderNumber,
          action,
          changes,
          user,
          req
        );
        
        console.log('📝 Changelog entry created for order update:', result.value.orderNumber, 'Changes:', changes.length);
      } else {
        console.log('ℹ️ No changes detected for order:', result.value.orderNumber);
      }
    } catch (changelogError) {
      console.error('❌ Failed to create changelog entry:', changelogError);
      // Don't fail the order update if changelog fails
    }
    
    console.log('✅ Order updated:', result.value.orderNumber);
    res.json(result.value);
    
  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ 
      message: 'Failed to update order',
      error: error.message
    });
  }
});

// DELETE /api/orders/:branchCode/:id - Delete order (UPDATED with changelog)
router.delete('/:branchCode/:id', auth, async (req, res) => {
  try {
    const { branchCode, id } = req.params;
    const user = req.user;
    
    console.log(`🗑️ Deleting order ${id} from branch ${branchCode}`);
    
    // Only admins can delete orders
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete orders' });
    }
    
    const collectionName = getOrderCollectionForBranch(branchCode);
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    const order = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Soft delete - change status instead of removing
    const result = await collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          status: 'cancelled',
          updatedBy: user.username || user.id,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    // ✅ CREATE CHANGELOG ENTRY FOR DELETION
    try {
      await createChangelogEntry(
        order._id,
        order.orderNumber,
        'deleted',
        [{ 
          field: 'status', 
          oldValue: order.status || 'active', 
          newValue: 'cancelled',
          displayName: 'Order Status'
        }],
        user,
        req
      );
      console.log('📝 Changelog entry created for order deletion:', order.orderNumber);
    } catch (changelogError) {
      console.error('❌ Failed to create changelog entry:', changelogError);
      // Don't fail the deletion if changelog fails
    }
    
    console.log('✅ Order cancelled:', result.value.orderNumber);
    res.json({ message: 'Order cancelled successfully', order: result.value });
    
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    res.status(500).json({ 
      message: 'Failed to delete order',
      error: error.message
    });
  }
});

// GET /api/orders/stats/summary - Get order statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { branch } = req.query;
    const user = req.user;
    
    console.log('📊 Calculating order statistics...');
    
    const filters = {};
    if (branch) filters.branch = branch;
    
    const orders = await fetchOrdersFromCollections(user, filters);
    
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0),
      totalAdvancePaid: orders.reduce((sum, order) => sum + (Number(order.advancePaid) || 0), 0),
      totalBalancePaid: orders.reduce((sum, order) => sum + (Number(order.balancePaid) || 0), 0),
      pendingBalance: orders.reduce((sum, order) => sum + (Number(order.balance) || 0), 0),
      totalBoxes: orders.reduce((sum, order) => sum + (Number(order.totalBoxCount) || 0), 0)
    };
    
    console.log('✅ Order stats calculated:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Error calculating stats:', error);
    res.status(500).json({ 
      message: 'Failed to calculate statistics',
      error: error.message
    });
  }
});

// Debug route (remove in production)
router.get('/debug/collections', async (req, res) => {
  try {
    const collections = await getOrderCollectionNames();
    const db = mongoose.connection.db;
    
    const result = {
      collections,
      details: []
    };
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      result.details.push({ name: collectionName, count });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;