const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const branchRoutes = require('./routes/branches');
const brandRoutes = require('./routes/brandRoutes');
const itemsRoutes = require('./routes/items'); // ADD THIS LINE
const occasionsRoutes = require('./routes/occasions'); // ADD THIS LINE
const ordersRoutes = require('./routes/orders'); // ADD THIS LINE

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Health check
app.get('/api/health', (req, res) => {
  res.send('API is healthy');
});

// Debug test route - Add this test route before your other routes
app.get('/api/test/users', async (req, res) => {
  try {
    const User = require('./models/User');
    const users = await User.find({}).limit(10);
    res.json({
      database: mongoose.connection.db.databaseName,
      userCount: users.length,
      users: users.map(u => ({ username: u.username, role: u.role }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/items', itemsRoutes); // ADD THIS LINE
app.use('/api/occasions', occasionsRoutes); // ADD THIS LINE
app.use('/api/orders', ordersRoutes); // ADD THIS LINE

// MongoDB connection with debug info
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('Connected to MongoDB Atlas');
  
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
    
    // List all users (for debugging only)
    const users = await User.find({}, 'username role').limit(5);
    console.log('👤 Sample users:', users);
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('MongoDB connection failed:', err);
});