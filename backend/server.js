const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const branchRoutes = require('./routes/branches');
const brandRoutes = require('./routes/brandRoutes');
const itemsRoutes = require('./routes/items');
const occasionsRoutes = require('./routes/occasions');
const ordersRoutes = require('./routes/orders');
// Add this line with your other route imports
const emailRoutes = require('./routes/emails');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ FIXED: CORS configuration with your actual URLs
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://order-management-six-liart.vercel.app', // Your Vercel deployment
    'https://order-management-six-liart-*.vercel.app', // Vercel preview deployments
    'http://192.168.0.141:3000', // Your IP address access
  ],
  credentials: true
}));

app.use(express.json());

// API Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// Add this line with your other route uses
app.use('/api/emails', emailRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/occasions', occasionsRoutes);
app.use('/api/orders', ordersRoutes);

// MongoDB connection with debug info
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('✅ Connected to MongoDB Atlas');
  
  // Debug: Check current database and collections
  const db = mongoose.connection.db;
  console.log('📊 Current database name:', db.databaseName);
  
  // List all collections
  const collections = await db.listCollections().toArray();
  console.log('📋 Available collections:', collections.map(c => c.name));
  
  // Check if users collection exists and count documents
  try {
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
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health check: ${PORT === 5000 ? 'http://localhost:5000' : `https://order-management-fbre.onrender.com`}/api/health`);
  });
}).catch((err) => {
  console.error('❌ MongoDB connection failed:', err);
});