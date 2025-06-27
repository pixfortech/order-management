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
const changelogRoutes = require('./routes/changelog');

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
    'http://192.168.0.177:3000',
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

// ===== BRANCH MANAGEMENT SYSTEM =====

class BranchManager {
  constructor() {
    this.cache = {
      branches: new Map(),
      nameToCode: new Map(),
      codeToName: new Map(),
      lastUpdated: null,
      cacheValidityMs: 5 * 60 * 1000 // 5 minutes
    };
  }

  async initialize() {
    await this.refreshCache();
  }

  async refreshCache() {
    try {
      console.log('🔄 Refreshing branch cache from database...');
      
      if (!db) {
        throw new Error('Database not connected');
      }
      
      const branchesCollection = db.collection('branches');
      const branches = await branchesCollection.find({ isActive: { $ne: false } }).toArray();
      
      // Clear existing cache
      this.cache.branches.clear();
      this.cache.nameToCode.clear();
      this.cache.codeToName.clear();
      
      branches.forEach(branch => {
        const code = branch.branchCode?.trim()?.toUpperCase();
        const name = branch.branchName?.trim();
        
        if (code && name) {
          // Store branch data
          this.cache.branches.set(code, branch);
          
          // Create bidirectional mappings (case-insensitive)
          this.cache.nameToCode.set(name.toLowerCase(), code);
          this.cache.codeToName.set(code, name);
        }
      });
      
      this.cache.lastUpdated = new Date();
      
      console.log('✅ Branch cache refreshed:', {
        branches: this.cache.branches.size,
        mappings: this.cache.nameToCode.size
      });
      
    } catch (error) {
      console.error('❌ Error refreshing branch cache:', error);
      // Keep existing cache on error
    }
  }

  async ensureCacheValid() {
    if (!this.cache.lastUpdated || 
        (new Date() - this.cache.lastUpdated) > this.cache.cacheValidityMs) {
      await this.refreshCache();
    }
  }

  async getBranchCodeFromName(name) {
    if (!name) return null;
    await this.ensureCacheValid();
    return this.cache.nameToCode.get(name.trim().toLowerCase()) || null;
  }

  async getBranchNameFromCode(code) {
    if (!code) return null;
    await this.ensureCacheValid();
    return this.cache.codeToName.get(code.trim().toUpperCase()) || code;
  }

  async getAllBranchCodes() {
    await this.ensureCacheValid();
    return Array.from(this.cache.branches.keys());
  }

  async getBranch(identifier) {
    await this.ensureCacheValid();
    
    // Try as code first
    const upperIdentifier = identifier?.trim()?.toUpperCase();
    if (this.cache.branches.has(upperIdentifier)) {
      return this.cache.branches.get(upperIdentifier);
    }
    
    // Try as name
    const code = await this.getBranchCodeFromName(identifier);
    if (code && this.cache.branches.has(code)) {
      return this.cache.branches.get(code);
    }
    
    return null;
  }

  async getCustomerCollectionName(branchCode) {
    if (!branchCode) return null;
    
    const code = branchCode.trim().toLowerCase();
    const collectionName = `customers_${code}`;
    
    // Verify collection exists
    try {
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length > 0) {
        return collectionName;
      }
    } catch (error) {
      console.warn('Error checking collection existence:', error.message);
    }
    
    return collectionName; // Return even if not exists for creation
  }
}

// Add this section to your server.js after the BranchManager class

// ===== ORDER MANAGEMENT ENHANCEMENTS =====

/**
 * Enhanced customer order search that works with branch-specific order collections
 */
async function findCustomerOrdersAcrossBranches(customer) {
  try {
    // Get all order collections
    const collections = await db.listCollections().toArray();
    const orderCollections = collections
      .filter(c => c.name === 'orders' || c.name.startsWith('orders_'))
      .map(c => c.name);
    
    console.log('🔍 Searching for customer orders in collections:', orderCollections);
    
    let allOrders = [];
    
    for (const collectionName of orderCollections) {
      try {
        const collection = db.collection(collectionName);
        
        // Search by exact name match and phone
        const queries = [];
        
        if (customer.name) {
          queries.push({ customerName: customer.name });
          queries.push({ customerName: new RegExp(customer.name.replace(/\s+/g, '\\s+'), 'i') });
        }
        
        if (customer.phone) {
          queries.push({ phone: customer.phone });
        }
        
        for (const query of queries) {
          const orders = await collection.find(query).toArray();
          if (orders.length > 0) {
            console.log(`✅ Found ${orders.length} orders in ${collectionName} for query:`, query);
            // Add source collection info
            const ordersWithSource = orders.map(order => ({
              ...order,
              _sourceCollection: collectionName
            }));
            allOrders = allOrders.concat(ordersWithSource);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not search ${collectionName}:`, error.message);
      }
    }
    
    // Deduplicate orders
    const uniqueOrders = deduplicateOrders(allOrders);
    
    // Sort by date (newest first)
    uniqueOrders.sort((a, b) => 
      new Date(b.createdAt || b.orderDate || 0) - new Date(a.createdAt || a.orderDate || 0)
    );
    
    // Calculate statistics
    const stats = calculateOrderStats(uniqueOrders);
    
    console.log(`📊 Customer order search complete: ${uniqueOrders.length} unique orders found`);
    
    return { orders: uniqueOrders, stats };
    
  } catch (error) {
    console.error('❌ Error finding customer orders:', error);
    return { 
      orders: [], 
      stats: { totalOrders: 0, distinctBoxes: 0, totalBoxes: 0, totalAmount: 0 }
    };
  }
}

// Update the existing customer details route to use the new order search
app.get('/api/customers/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📊 Fetching customer details for:', id);
    
    // Find customer
    const { customer, branchCode } = await findCustomerAcrossBranches(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Find orders for this customer using enhanced search
    const { orders, stats } = await findCustomerOrdersAcrossBranches(customer);
    
    console.log('✅ Customer details fetched:', {
      customerName: customer.name,
      ordersCount: orders.length,
      stats
    });
    
    res.json({
      customer: {
        ...customer,
        branchCode,
        branchName: await branchManager.getBranchNameFromCode(branchCode)
      },
      orders,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching customer details:', error);
    res.status(500).json({ message: 'Failed to fetch customer details', error: error.message });
  }
});

// Add a route to get order collection info (for debugging)
app.get('/api/debug/order-collections', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const collections = await db.listCollections().toArray();
    const orderCollections = collections.filter(c => 
      c.name === 'orders' || c.name.startsWith('orders_')
    );
    
    const result = {
      totalCollections: collections.length,
      orderCollections: [],
      summary: {
        totalOrders: 0,
        collectionCount: orderCollections.length
      }
    };
    
    for (const collection of orderCollections) {
      try {
        const orderCollection = db.collection(collection.name);
        const count = await orderCollection.countDocuments();
        const sampleOrder = await orderCollection.findOne();
        
        result.orderCollections.push({
          name: collection.name,
          count,
          branchCode: collection.name.replace('orders_', '').toUpperCase(),
          hasOrders: count > 0,
          sampleOrderNumber: sampleOrder?.orderNumber
        });
        
        result.summary.totalOrders += count;
        
      } catch (error) {
        console.error(`❌ Error checking ${collection.name}:`, error.message);
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error getting order collection info:', error);
    res.status(500).json({ message: 'Failed to get collection info', error: error.message });
  }
});

// Initialize branch manager
const branchManager = new BranchManager();

// ===== CUSTOMER API ROUTES =====

// GET /api/customers - Get all customers
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { branch } = req.query;
    const user = req.user;
    
    console.log('🔍 Fetching customers for user:', user.username, 'role:', user.role);
    
    let customers = [];
    
    if (user.role === 'admin') {
      if (branch) {
        // Fetch from specific branch
        const branchCode = await branchManager.getBranchCodeFromName(branch);
        if (branchCode) {
          customers = await fetchCustomersFromBranch(branchCode);
        }
      } else {
        // Fetch from all branches
        const branchCodes = await branchManager.getAllBranchCodes();
        
        for (const branchCode of branchCodes) {
          const branchCustomers = await fetchCustomersFromBranch(branchCode);
          customers = customers.concat(branchCustomers);
        }
      }
    } else {
      // Non-admin: only their branch
      const userBranchCode = await branchManager.getBranchCodeFromName(user.branchName || user.branch);
      if (userBranchCode) {
        customers = await fetchCustomersFromBranch(userBranchCode);
      }
    }
    
    console.log('✅ Found', customers.length, 'customers');
    res.json(customers);
    
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers', error: error.message });
  }
});

// Helper function to fetch customers from a specific branch
async function fetchCustomersFromBranch(branchCode) {
  try {
    const collectionName = await branchManager.getCustomerCollectionName(branchCode);
    const collection = db.collection(collectionName);
    const customers = await collection.find({}).toArray();
    
    const branchName = await branchManager.getBranchNameFromCode(branchCode);
    
    return customers.map(customer => ({
      ...customer,
      branchCode: customer.branchCode || branchCode,
      branchName: customer.branchName || branchName
    }));
    
  } catch (error) {
    console.warn(`⚠️ Error fetching from branch ${branchCode}:`, error.message);
    return [];
  }
}

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
    
    // Get target branch
    const targetBranchCode = branchCode || await branchManager.getBranchCodeFromName(branch);
    if (!targetBranchCode) {
      return res.status(400).json({ message: 'Invalid branch specified' });
    }
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = await branchManager.getBranchCodeFromName(user.branchName || user.branch);
      if (targetBranchCode !== userBranchCode) {
        return res.status(403).json({ message: 'You can only add customers to your own branch' });
      }
    }
    
    const collectionName = await branchManager.getCustomerCollectionName(targetBranchCode);
    const collection = db.collection(collectionName);
    
    // Check if customer already exists
    const existingCustomer = await collection.findOne({ phone: phone });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer with this phone number already exists' });
    }
    
    const branchName = await branchManager.getBranchNameFromCode(targetBranchCode);
    
    const customerData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      branchCode: targetBranchCode,
      branchName: branchName,
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
    
    const targetBranchCode = branchCode || await branchManager.getBranchCodeFromName(branch);
    if (!targetBranchCode) {
      return res.status(400).json({ message: 'Invalid branch specified' });
    }
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = await branchManager.getBranchCodeFromName(user.branchName || user.branch);
      if (targetBranchCode !== userBranchCode) {
        return res.status(403).json({ message: 'You can only update customers in your own branch' });
      }
    }
    
    const collectionName = await branchManager.getCustomerCollectionName(targetBranchCode);
    const collection = db.collection(collectionName);
    
    // Check if customer exists
    const existingCustomer = await collection.findOne({ _id: new ObjectId(id) });
    if (!existingCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check for duplicate phone (excluding current customer)
    if (phone !== existingCustomer.phone) {
      const phoneExists = await collection.findOne({ 
        phone: phone, 
        _id: { $ne: new ObjectId(id) } 
      });
      if (phoneExists) {
        return res.status(400).json({ message: 'Customer with this phone number already exists' });
      }
    }
    
    const branchName = await branchManager.getBranchNameFromCode(targetBranchCode);
    
    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      branchCode: targetBranchCode,
      branchName: branchName,
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
    
    // Find customer across branches
    const { customer, branchCode } = await findCustomerAcrossBranches(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (user.role !== 'admin') {
      const userBranchCode = await branchManager.getBranchCodeFromName(user.branchName || user.branch);
      if (branchCode !== userBranchCode) {
        return res.status(403).json({ message: 'You can only delete customers from your own branch' });
      }
    }
    
    const collectionName = await branchManager.getCustomerCollectionName(branchCode);
    const collection = db.collection(collectionName);
    
    await collection.deleteOne({ _id: new ObjectId(id) });
    
    console.log('✅ Customer deleted');
    res.json({ message: 'Customer deleted successfully' });
    
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    res.status(500).json({ message: 'Failed to delete customer', error: error.message });
  }
});

// Helper function to find customer across all branches
async function findCustomerAcrossBranches(customerId) {
  const branchCodes = await branchManager.getAllBranchCodes();
  
  for (const branchCode of branchCodes) {
    try {
      const collectionName = await branchManager.getCustomerCollectionName(branchCode);
      const collection = db.collection(collectionName);
      const customer = await collection.findOne({ _id: new ObjectId(customerId) });
      
      if (customer) {
        return { customer, branchCode };
      }
    } catch (error) {
      console.warn(`Error searching in branch ${branchCode}:`, error.message);
    }
  }
  
  return { customer: null, branchCode: null };
}

// GET /api/customers/:id/details - Get customer with order history
app.get('/api/customers/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📊 Fetching customer details for:', id);
    
    // Find customer
    const { customer, branchCode } = await findCustomerAcrossBranches(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Find orders for this customer
    const { orders, stats } = await findCustomerOrders(customer);
    
    console.log('✅ Customer details fetched:', {
      customerName: customer.name,
      ordersCount: orders.length,
      stats
    });
    
    res.json({
      customer: {
        ...customer,
        branchCode,
        branchName: await branchManager.getBranchNameFromCode(branchCode)
      },
      orders,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching customer details:', error);
    res.status(500).json({ message: 'Failed to fetch customer details', error: error.message });
  }
});

// Helper function to find customer orders and calculate stats
async function findCustomerOrders(customer) {
  try {
    const orderCollections = ['orders'];
    const branchCodes = await branchManager.getAllBranchCodes();
    
    // Add branch-specific order collections
    branchCodes.forEach(code => {
      orderCollections.push(`orders_${code.toLowerCase()}`);
    });
    
    let allOrders = [];
    
    for (const collectionName of orderCollections) {
      try {
        const collection = db.collection(collectionName);
        
        // Search by exact name match and phone
        const nameOrders = await collection.find({
          customerName: customer.name
        }).toArray();
        
        const phoneOrders = customer.phone ? await collection.find({
          phone: customer.phone
        }).toArray() : [];
        
        allOrders = allOrders.concat(nameOrders, phoneOrders);
        
      } catch (error) {
        console.warn(`Collection ${collectionName} not accessible:`, error.message);
      }
    }
    
    // Deduplicate orders
    const uniqueOrders = deduplicateOrders(allOrders);
    
    // Sort by date (newest first)
    uniqueOrders.sort((a, b) => 
      new Date(b.createdAt || b.orderDate || 0) - new Date(a.createdAt || a.orderDate || 0)
    );
    
    // Calculate statistics
    const stats = calculateOrderStats(uniqueOrders);
    
    return { orders: uniqueOrders, stats };
    
  } catch (error) {
    console.error('Error finding customer orders:', error);
    return { 
      orders: [], 
      stats: { totalOrders: 0, distinctBoxes: 0, totalBoxes: 0, totalAmount: 0 }
    };
  }
}

// Helper function to deduplicate orders
function deduplicateOrders(orders) {
  const seen = new Set();
  const unique = [];
  
  orders.forEach(order => {
    const key = order._id?.toString() || order.orderNumber || `${order.customerName}-${order.createdAt}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(order);
    }
  });
  
  return unique;
}

// Helper function to calculate order statistics
function calculateOrderStats(orders) {
  let totalOrders = orders.length;
  let totalBoxes = 0;
  let distinctBoxes = 0;
  let totalAmount = 0;
  
  orders.forEach(order => {
    // Add to total amount
    if (order.grandTotal) {
      totalAmount += Number(order.grandTotal);
    }
    
    // Count boxes
    if (order.boxes && Array.isArray(order.boxes)) {
      distinctBoxes += order.boxes.length;
      
      order.boxes.forEach(box => {
        totalBoxes += Number(box.boxCount) || 1;
      });
    } else if (order.totalBoxCount) {
      totalBoxes += Number(order.totalBoxCount);
      distinctBoxes += 1;
    }
  });
  
  return {
    totalOrders,
    distinctBoxes,
    totalBoxes,
    totalAmount
  };
}

// POST /api/admin/refresh-branch-cache - Manually refresh cache
app.post('/api/admin/refresh-branch-cache', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    await branchManager.refreshCache();
    
    res.json({ 
      message: 'Branch cache refreshed successfully',
      branches: branchManager.cache.branches.size,
      lastUpdated: branchManager.cache.lastUpdated
    });
    
  } catch (error) {
    console.error('❌ Error refreshing branch cache:', error);
    res.status(500).json({ message: 'Failed to refresh branch cache', error: error.message });
  }
});

// ===== HEALTH CHECK AND ROUTES =====

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: db ? 'connected' : 'disconnected',
    branchCache: {
      branches: branchManager.cache.branches.size,
      lastUpdated: branchManager.cache.lastUpdated
    }
  });
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
app.use('/api/changelog', changelogRoutes);

// ===== DATABASE CONNECTION AND SERVER STARTUP =====

async function connectToDatabase() {
  try {
    // Connect to MongoDB using Mongoose
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas via Mongoose');
    
    // Connect using native MongoDB client for direct operations
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db('SweetsOrder');
    console.log('✅ Connected to MongoDB Atlas via native client');
    
    // Initialize branch manager
    await branchManager.initialize();
    
    console.log('📊 Database setup complete');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Health check: /api/health`);
      console.log(`👥 Customers API: /api/customers`);
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