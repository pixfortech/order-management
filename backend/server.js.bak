const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const brandRoutes = require('./routes/brandRoutes');
const themeRoutes = require('./routes/theme'); // New theme routes
const itemRoutes = require('./routes/items');
const occasionRoutes = require('./routes/occasions');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log('Using URI:', process.env.MONGODB_URI);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: 'https://order-management-six-liart.vercel.app',
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // For image uploads
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/brand', brandRoutes); // Brand management
app.use('/api/theme', themeRoutes); // Theme management
app.use('/api/items', itemRoutes);
app.use('/api/occasions', occasionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    server: 'Ganguram Order System API'
  });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/health',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/branches',
      'GET /api/brand',
      'PUT /api/brand',
      'GET /api/theme',
      'PUT /api/theme',
      'GET /api/items',
      'POST /api/items',
      'GET /api/occasions',
      'POST /api/occasions'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message });
  }
  
  if (error.code === 11000) { // MongoDB duplicate key error
    return res.status(400).json({ message: 'Duplicate entry found' });
  }
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler - make sure this is last
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /api/health',
      'GET /api/test',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/branches',
      'GET /api/brand',
      'PUT /api/brand',
      'GET /api/theme',
      'PUT /api/theme'
    ]
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/test`);
});

module.exports = app;