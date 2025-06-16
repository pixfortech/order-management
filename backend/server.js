const express = require('express');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const branchRoutes = require('./routes/branches');
const brandRoutes = require('./routes/brandRoutes');
const itemsRoutes = require('./routes/items');
const occasionsRoutes = require('./routes/occasions');
const ordersRoutes = require('./routes/orders');
const emailRoutes = require('./routes/emails');
const vendorsRoutes = require('./routes/vendors');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection URI
const MONGODB_URI = 'mongodb+srv://masteradmin:admin123@order-management.an0zavz.mongodb.net/SweetsOrder';

// Initialize MongoDB client for direct database operations
let mongoClient;
let db;

// ===== MIDDLEWARE =====
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://order-management-six-liart.vercel.app',
    'https://order-management-six-liart-*.vercel.app',
	/^https:\/\/order-management-.*\.vercel\.app$/,
    'http://192.168.0.141:3000',
  ],
  credentials: true
}));

app.use(express.json());

// Authentication middleware
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

// ===== DYNAMIC BRANCH MAPPING SYSTEM =====

// Cache for branch mappings to avoid repeated database calls
let branchCache = {
  nameToCode: {},
  codeToName: {},
  lastUpdated: null,
  cacheValidityMs: 5 * 60 * 1000 // 5 minutes cache
};

// Function to refresh branch cache from database (UPDATED)
async function refreshBranchCache() {
  try {
    console.log('🔄 Refreshing branch cache from database...');
    
    if (!db) {
      throw new Error('Database not connected');
    }
    
    const branchesCollection = db.collection('branches');
    const branches = await branchesCollection.find({}).toArray();
    
    const nameToCode = {};
    const codeToName = {};
    
    branches.forEach(branch => {
      // Store both original case and lowercase for flexible matching
      const originalCode = branch.branchCode;
      const lowerCode = branch.branchCode.toLowerCase();
      const originalName = branch.branchName;
      const lowerName = branch.branchName.toLowerCase();
      
      // Map names to codes (both cases)
      nameToCode[originalName] = originalCode;
      nameToCode[lowerName] = originalCode;
      
      // Map codes to names (both cases)
      codeToName[originalCode] = originalName;
      codeToName[lowerCode] = originalName;
      codeToName[originalCode.toLowerCase()] = originalName;
      codeToName[lowerCode.toUpperCase()] = originalName;
    });
    
    branchCache = {
      nameToCode,
      codeToName,
      lastUpdated: new Date(),
      cacheValidityMs: 5 * 60 * 1000
    };
    
    console.log('✅ Branch cache refreshed:', {
      branches: branches.length,
      mappings: Object.keys(nameToCode).length
    });
    
  } catch (error) {
    console.error('❌ Error refreshing branch cache:', error);
    branchCache = {
      nameToCode: {},
      codeToName: {},
      lastUpdated: new Date(),
      cacheValidityMs: 5 * 60 * 1000
    };
  }
}

// Function to get branch code from name (UPDATED - case insensitive)
async function getBranchCodeFromName(name) {
  if (!name) return null;
  
  // Check if cache needs refresh
  if (!branchCache.lastUpdated || 
      (new Date() - branchCache.lastUpdated) > branchCache.cacheValidityMs) {
    await refreshBranchCache();
  }
  
  // Try exact match first, then lowercase
  return branchCache.nameToCode[name] || 
         branchCache.nameToCode[name.toLowerCase()] || 
         null;
}

// Function to get branch name from code (with automatic cache refresh)
async function getBranchNameFromCode(code) {
  if (!code) return null;
  
  // Check if cache needs refresh
  if (!branchCache.lastUpdated || 
      (new Date() - branchCache.lastUpdated) > branchCache.cacheValidityMs) {
    await refreshBranchCache();
  }
  
  // Try exact match first, then case variations
  return branchCache.codeToName[code] || 
         branchCache.codeToName[code.toLowerCase()] || 
         branchCache.codeToName[code.toUpperCase()] || 
         code;
}

// Function to get branch code from name (with automatic cache refresh)
async function getBranchCodeFromName(name) {
  if (!name) return null;
  
  // Check if cache needs refresh
  if (!branchCache.lastUpdated || 
      (new Date() - branchCache.lastUpdated) > branchCache.cacheValidityMs) {
    await refreshBranchCache();
  }
  
  return branchCache.nameToCode[name.toLowerCase()] || null;
}

// Function to get all available branch codes (UPDATED)
async function getAllBranchCodes() {
  if (!branchCache.lastUpdated || 
      (new Date() - branchCache.lastUpdated) > branchCache.cacheValidityMs) {
    await refreshBranchCache();
  }
  
  // Get unique codes from the cache, prioritizing original case
  const codes = new Set();
  Object.values(branchCache.nameToCode).forEach(code => {
    if (code && code.length <= 3) { // Assume branch codes are 2-3 characters
      codes.add(code);
    }
  });
  
  return Array.from(codes);
}

// NEW HELPER FUNCTION: Get collection name with case-insensitive matching
async function getCustomerCollectionName(branchCode) {
  if (!branchCode) return null;
  
  // Try different case variations for collection names
  const variations = [
    `customers_${branchCode.toLowerCase()}`,
    `customers_${branchCode.toUpperCase()}`,
    `customers_${branchCode}`
  ];
  
  // Check which collection actually exists
  const collections = await db.listCollections().toArray();
  const existingCollections = collections.map(c => c.name);
  
  for (const variation of variations) {
    if (existingCollections.includes(variation)) {
      return variation;
    }
  }
  
  // Default to lowercase if none found
  return `customers_${branchCode.toLowerCase()}`;
}

// ===== CUSTOMER API ROUTES =====

// GET /api/customers - Get all customers (UPDATED for case-insensitive)
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { branch } = req.query;
    const user = req.user;
    
    console.log('🔍 Fetching customers for user:', user.username, 'role:', user.role);
    
    let customers = [];
    
    if (user.role === 'admin') {
      // Admin can see all customers from all branches
      if (branch) {
        // If specific branch requested
        const collectionName = await getCustomerCollectionName(branch);
        console.log('📊 Fetching from collection:', collectionName);
        
        try {
          const collection = db.collection(collectionName);
          customers = await collection.find({}).toArray();
          
          // Add branch info to each customer
          const branchName = await getBranchNameFromCode(branch);
          customers = customers.map(customer => ({
            ...customer,
            branchCode: customer.branchCode || branch,
            branchName: customer.branchName || branchName
          }));
        } catch (collectionError) {
          console.warn(`⚠️ Collection ${collectionName} not found:`, collectionError.message);
        }
      } else {
        // Fetch from all branch collections
        const branchCodes = await getAllBranchCodes();
        console.log('🔍 Available branch codes:', branchCodes);
        
        for (const branchCode of branchCodes) {
          const collectionName = await getCustomerCollectionName(branchCode);
          console.log('📊 Fetching from collection:', collectionName);
          
          try {
            const collection = db.collection(collectionName);
            const branchCustomers = await collection.find({}).toArray();
            
            // Add branch info to each customer
            const branchName = await getBranchNameFromCode(branchCode);
            const customersWithBranch = branchCustomers.map(customer => ({
              ...customer,
              branchCode: customer.branchCode || branchCode,
              branchName: customer.branchName || branchName
            }));
            
            customers = customers.concat(customersWithBranch);
          } catch (collectionError) {
            console.warn(`⚠️ Collection ${collectionName} not found:`, collectionError.message);
          }
        }
      }
    } else {
      // Non-admin users can only see their branch customers
      const userBranchCode = await getBranchCodeFromName(user.branchName || user.branch);
      if (userBranchCode) {
        const collectionName = await getCustomerCollectionName(userBranchCode);
        console.log('📊 Fetching from collection:', collectionName);
        
        try {
          const collection = db.collection(collectionName);
          customers = await collection.find({}).toArray();
          
          // Add branch info to each customer
          const branchName = await getBranchNameFromCode(userBranchCode);
          customers = customers.map(customer => ({
            ...customer,
            branchCode: customer.branchCode || userBranchCode,
            branchName: customer.branchName || branchName
          }));
        } catch (collectionError) {
          console.warn(`⚠️ Collection ${collectionName} not found:`, collectionError.message);
          customers = [];
        }
      }
    }
    
    console.log('✅ Found', customers.length, 'customers');
    res.json(customers);
    
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers', error: error.message });
  }
});

// POST /api/customers - Create new customer
app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, address, branch, branchCode } = req.body;
    const user = req.user;
    
    console.log('➕ Creating customer:', { name, phone, branch, branchCode });
    
    // Validate required fields
    if (!name || !phone || !branch) {
      return res.status(400).json({ message: 'Name, phone, and branch are required' });
    }
    
    // Validate phone number
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }
    
    // Get branch code dynamically
    const targetBranchCode = branchCode || await getBranchCodeFromName(branch);
    if (!targetBranchCode) {
      return res.status(400).json({ message: 'Invalid branch specified' });
    }
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = await getBranchCodeFromName(user.branchName || user.branch);
      if (targetBranchCode !== userBranchCode) {
        return res.status(403).json({ message: 'You can only add customers to your own branch' });
      }
    }
    
    const collectionName = `customers_${targetBranchCode.toLowerCase()}`;
    console.log('📊 Adding to collection:', collectionName);
    
    // Check if customer already exists (by phone)
    const collection = db.collection(collectionName);
    const existingCustomer = await collection.findOne({ phone: phone });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer with this phone number already exists' });
    }
    
    const customerData = {
      name,
      phone,
      email: email || null,
      address: address || null,
      branchCode: targetBranchCode,
      branchName: branch,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(customerData);
    
    const newCustomer = {
      _id: result.insertedId,
      ...customerData
    };
    
    console.log('✅ Customer created:', newCustomer._id);
    res.status(201).json(newCustomer);
    
  } catch (error) {
    console.error('❌ Error creating customer:', error);
    res.status(500).json({ message: 'Failed to create customer', error: error.message });
  }
});

// PUT /api/customers/:id - Update customer
app.put('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, branch, branchCode } = req.body;
    const user = req.user;
    
    console.log('✏️ Updating customer:', id);
    
    // Validate required fields
    if (!name || !phone || !branch) {
      return res.status(400).json({ message: 'Name, phone, and branch are required' });
    }
    
    // Validate phone number
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }
    
    const targetBranchCode = branchCode || await getBranchCodeFromName(branch);
    if (!targetBranchCode) {
      return res.status(400).json({ message: 'Invalid branch specified' });
    }
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = await getBranchCodeFromName(user.branchName || user.branch);
      if (targetBranchCode !== userBranchCode) {
        return res.status(403).json({ message: 'You can only update customers in your own branch' });
      }
    }
    
    const collectionName = `customers_${targetBranchCode.toLowerCase()}`;
    const collection = db.collection(collectionName);
    
    // Check if customer exists
    const existingCustomer = await collection.findOne({ _id: new ObjectId(id) });
    if (!existingCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if phone is being changed and if new phone already exists
    if (phone !== existingCustomer.phone) {
      const phoneExists = await collection.findOne({ 
        phone: phone, 
        _id: { $ne: new ObjectId(id) } 
      });
      if (phoneExists) {
        return res.status(400).json({ message: 'Customer with this phone number already exists' });
      }
    }
    
    const updateData = {
      name,
      phone,
      email: email || null,
      address: address || null,
      branchCode: targetBranchCode,
      branchName: branch,
      updatedAt: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    console.log('✅ Customer updated:', id);
    res.json(result.value);
    
  } catch (error) {
    console.error('❌ Error updating customer:', error);
    res.status(500).json({ message: 'Failed to update customer', error: error.message });
  }
});

// DELETE /api/customers/:id - Delete customer
app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    console.log('🗑️ Deleting customer:', id);
    
    // Find customer across all branch collections
    let customerFound = false;
    const branchCodes = await getAllBranchCodes();
    
    for (const branchCode of branchCodes) {
      const collectionName = `customers_${branchCode}`;
      const collection = db.collection(collectionName);
      
      try {
        const customer = await collection.findOne({ _id: new ObjectId(id) });
        if (customer) {
          // Check permissions
          if (user.role !== 'admin') {
            const userBranchCode = await getBranchCodeFromName(user.branchName || user.branch);
            if (branchCode !== userBranchCode) {
              return res.status(403).json({ message: 'You can only delete customers from your own branch' });
            }
          }
          
          await collection.deleteOne({ _id: new ObjectId(id) });
          customerFound = true;
          console.log('✅ Customer deleted from', collectionName);
          break;
        }
      } catch (collectionError) {
        console.warn(`⚠️ Error checking collection ${collectionName}:`, collectionError.message);
      }
    }
    
    if (!customerFound) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
    
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    res.status(500).json({ message: 'Failed to delete customer', error: error.message });
  }
});

// GET /api/customers/:id/details - Enhanced with better order search
app.get('/api/customers/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    console.log('📊 Fetching customer details for:', id);
    
    // Find customer across all branch collections
    let customer = null;
    let customerBranchCode = null;
    const branchCodes = await getAllBranchCodes();
    
    for (const branchCode of branchCodes) {
      const collectionName = await getCustomerCollectionName(branchCode);
      const collection = db.collection(collectionName);
      
      try {
        const foundCustomer = await collection.findOne({ _id: new ObjectId(id) });
        if (foundCustomer) {
          customer = foundCustomer;
          customerBranchCode = branchCode;
          break;
        }
      } catch (collectionError) {
        console.warn(`⚠️ Error checking collection ${collectionName}:`, collectionError.message);
      }
    }
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Initialize stats with proper default values
    let stats = {
      totalOrders: 0,
      distinctBoxes: 0,
      totalBoxes: 0,
      totalAmount: 0
    };
    
    let orders = [];
    
    try {
      console.log('🔍 Searching for orders...');
      console.log('👤 Customer name:', `"${customer.name}"`);
      console.log('📞 Customer phone:', `"${customer.phone}"`);
      
      // ✅ ENHANCED: Search in multiple order collections
      const orderCollections = ['orders']; // Start with main orders collection
      
      // Add branch-specific order collections if they exist
      for (const branchCode of branchCodes) {
        orderCollections.push(`orders_${branchCode.toLowerCase()}`);
      }
      
      console.log('🔍 Searching in collections:', orderCollections);
      
      for (const collectionName of orderCollections) {
        try {
          const ordersCollection = db.collection(collectionName);
          
          console.log(`🔍 Searching in ${collectionName}...`);
          
          // Search by customer name (exact match and variations)
          const nameSearches = [
            { customerName: customer.name },
            { customerName: new RegExp(customer.name.replace(/\s+/g, '\\s+'), 'i') }, // Case insensitive with flexible spaces
          ];
          
          for (const nameSearch of nameSearches) {
            const ordersByName = await ordersCollection.find(nameSearch).sort({ createdAt: -1 }).toArray();
            if (ordersByName.length > 0) {
              console.log(`✅ Found ${ordersByName.length} orders by name in ${collectionName}:`, 
                ordersByName.map(o => o.orderNumber));
              orders.push(...ordersByName);
            }
          }
          
          // Search by phone number if available
          if (customer.phone) {
            const ordersByPhone = await ordersCollection.find({ 
              phone: customer.phone 
            }).sort({ createdAt: -1 }).toArray();
            
            if (ordersByPhone.length > 0) {
              console.log(`✅ Found ${ordersByPhone.length} orders by phone in ${collectionName}:`, 
                ordersByPhone.map(o => o.orderNumber));
              orders.push(...ordersByPhone);
            }
          }
          
        } catch (collectionError) {
          console.warn(`⚠️ Collection ${collectionName} not accessible:`, collectionError.message);
        }
      }
      
      // ✅ ENHANCED: Deduplicate orders more reliably
      const uniqueOrders = [];
      const seenOrderIds = new Set();
      const seenOrderNumbers = new Set();
      
      orders.forEach(order => {
        const orderId = order._id?.toString();
        const orderNumber = order.orderNumber;
        
        if (orderId && !seenOrderIds.has(orderId)) {
          seenOrderIds.add(orderId);
          uniqueOrders.push(order);
        } else if (orderNumber && !seenOrderNumbers.has(orderNumber) && !orderId) {
          seenOrderNumbers.add(orderNumber);
          uniqueOrders.push(order);
        }
      });
      
      orders = uniqueOrders.sort((a, b) => new Date(b.createdAt || b.orderDate) - new Date(a.createdAt || a.orderDate));
      
      console.log(`🔍 Final unique orders found: ${orders.length}`);
      if (orders.length > 0) {
        console.log('📋 Order numbers:', orders.map(o => o.orderNumber));
      }
      
      // ✅ Calculate statistics with proper box counting
      if (orders.length > 0) {
        let totalBoxCount = 0;
        let totalAmount = 0;
        let totalDistinctBoxes = 0;
        
        orders.forEach((order, orderIndex) => {
          console.log(`📦 Processing order ${orderIndex + 1}: ${order.orderNumber}`);
          console.log(`📦 Order structure:`, {
            hasBoxes: !!order.boxes,
            boxesLength: order.boxes?.length,
            totalBoxCount: order.totalBoxCount,
            grandTotal: order.grandTotal
          });
          
          // Add to total amount
          if (order.grandTotal) {
            totalAmount += order.grandTotal;
            console.log(`💰 Added ₹${order.grandTotal} to total, new total: ₹${totalAmount}`);
          }
          
          // Count boxes correctly
          if (order.boxes && Array.isArray(order.boxes)) {
            // Each element in the boxes array is ONE distinct box type
            totalDistinctBoxes += order.boxes.length;
            console.log(`🎁 Found ${order.boxes.length} distinct box types in this order`);
            
            // Sum up the boxCount from each box for total boxes
            order.boxes.forEach((box, boxIndex) => {
              const boxCount = box.boxCount || 1;
              totalBoxCount += boxCount;
              console.log(`📊 Box ${boxIndex + 1}: ${boxCount} boxes (items: ${box.items?.length || 0})`);
            });
          } else {
            // Fallback: use totalBoxCount from order if boxes array not available
            if (order.totalBoxCount) {
              totalBoxCount += order.totalBoxCount;
              totalDistinctBoxes += 1; // Assume 1 distinct box type
              console.log(`📊 Using order totalBoxCount: ${order.totalBoxCount}`);
            }
          }
        });
        
        // Update stats with calculated values
        stats = {
          totalOrders: orders.length,
          distinctBoxes: totalDistinctBoxes,
          totalBoxes: totalBoxCount,
          totalAmount: totalAmount
        };
        
        console.log('📊 Final calculated stats:', stats);
      } else {
        console.log('⚠️ No orders found, using fallback from customer document');
        // Use stored customer stats as fallback
        stats = {
          totalOrders: customer.totalOrders || 0,
          distinctBoxes: 0, // No orders means no boxes
          totalBoxes: 0,    // No orders means no boxes
          totalAmount: customer.totalSpent || 0
        };
      }
      
    } catch (ordersError) {
      console.error('⚠️ Error fetching orders:', ordersError.message);
      // In case of error, try to use customer document stats
      stats = {
        totalOrders: customer.totalOrders || 0,
        distinctBoxes: 0,
        totalBoxes: 0,
        totalAmount: customer.totalSpent || 0
      };
    }
    
    console.log('✅ Returning data:', {
      customerName: customer.name,
      ordersCount: orders.length,
      statsCalculated: stats
    });
    
    res.json({
      customer,
      orders,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ message: 'Failed to fetch customer details', error: error.message });
  }
});

// POST /api/admin/refresh-branch-cache - Manually refresh branch cache (admin only)
app.post('/api/admin/refresh-branch-cache', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can refresh branch cache' });
    }
    
    await refreshBranchCache();
    
    res.json({ 
      message: 'Branch cache refreshed successfully',
      cache: {
        branches: Object.keys(branchCache.nameToCode).length / 2,
        lastUpdated: branchCache.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('❌ Error refreshing branch cache:', error);
    res.status(500).json({ message: 'Failed to refresh branch cache', error: error.message });
  }
});

// ===== HEALTH CHECK AND DEBUG ROUTES =====

// API Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: db ? 'connected' : 'disconnected'
  });
});

// Debug test route
app.get('/api/test/users', async (req, res) => {
  try {
    const User = require('./models/User');
    const users = await User.find({}).limit(10);
    res.json({
      database: mongoose.connection.db.databaseName,
      userCount: users.length,
      users: users.map(u => ({ 
        username: u.username, 
        role: u.role, 
        branchCode: u.branchCode,
        branchName: u.branchName 
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug branch cache route
app.get('/api/debug/branch-cache', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view debug info' });
    }
    
    res.json({
      branchCache: {
        nameToCode: branchCache.nameToCode,
        codeToName: branchCache.codeToName,
        lastUpdated: branchCache.lastUpdated,
        cacheAge: branchCache.lastUpdated ? new Date() - branchCache.lastUpdated : null
      },
      availableBranchCodes: await getAllBranchCodes()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this to your server.js temporarily
app.get('/api/debug/live-test', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Live debug test...');
    
    // Force refresh cache
    await refreshBranchCache();
    
    // Check what we got
    const branchCodes = await getAllBranchCodes();
    console.log('🏢 Available branch codes:', branchCodes);
    
    // Test one collection
    const testCollection = 'customers_bd';
    const collection = db.collection(testCollection);
    const customers = await collection.find({}).toArray();
    
    console.log(`📊 Found ${customers.length} customers in ${testCollection}`);
    console.log('🔍 First customer:', customers[0]);
    
    res.json({
      branchCache,
      branchCodes,
      testCollection,
      customerCount: customers.length,
      firstCustomer: customers[0]
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add this to your server.js - no authentication needed
app.get('/api/debug/simple-test', async (req, res) => {
  try {
    console.log('🔍 Simple debug test...');
    
    // Check database connection
    if (!db) {
      return res.json({ error: 'Database not connected' });
    }
    
    // Force refresh cache
    await refreshBranchCache();
    
    // Check what we got
    const branchCodes = await getAllBranchCodes();
    console.log('🏢 Available branch codes:', branchCodes);
    
    // Check branches collection
    const branches = await db.collection('branches').find({}).toArray();
    console.log('🏢 Branches from DB:', branches.length);
    
    // Test one collection
    const testCollection = 'customers_bd';
    const collection = db.collection(testCollection);
    const customers = await collection.find({}).toArray();
    
    console.log(`📊 Found ${customers.length} customers in ${testCollection}`);
    
    res.json({
      database: 'connected',
      branchesCount: branches.length,
      branchCodes,
      testCollection,
      customerCount: customers.length,
      branchCache: {
        nameToCode: Object.keys(branchCache.nameToCode).length,
        codeToName: Object.keys(branchCache.codeToName).length,
        lastUpdated: branchCache.lastUpdated
      }
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ===== EXISTING ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/occasions', occasionsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ===== DATABASE CONNECTION AND SERVER STARTUP =====

async function connectToDatabase() {
  try {
    // Connect to MongoDB using Mongoose (for existing models)
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas via Mongoose');
    
    // Also connect using native MongoDB client for customer operations
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db('SweetsOrder');
    console.log('✅ Connected to MongoDB Atlas via native client');
    
    // Initialize branch cache
    await refreshBranchCache();
    
    // Debug: Check current database and collections
    console.log('📊 Current database name:', db.databaseName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));
    
    // Check if users collection exists and count documents
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    console.log('👥 Total users in database:', userCount);
    
    // List sample users
    const users = await User.find({}, 'username role branchCode branchName').limit(5);
    console.log('👤 Sample users:', users.map(u => ({
      username: u.username,
      role: u.role,
      branchCode: u.branchCode,
      branchName: u.branchName
    })));
    
    // Check customer collections
    const customerCollections = collections.filter(c => c.name.startsWith('customers_'));
    console.log('👥 Customer collections found:', customerCollections.map(c => c.name));
    
    for (const collection of customerCollections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`📊 ${collection.name}: ${count} customers`);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Start the server
async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Health check: ${PORT === 5000 ? 'http://localhost:5000' : `https://order-management-fbre.onrender.com`}/api/health`);
      console.log(`👥 Customers API: ${PORT === 5000 ? 'http://localhost:5000' : `https://order-management-fbre.onrender.com`}/api/customers`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  
  try {
    if (mongoClient) {
      await mongoClient.close();
      console.log('✅ MongoDB native client disconnected');
    }
    
    await mongoose.disconnect();
    console.log('✅ Mongoose disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();