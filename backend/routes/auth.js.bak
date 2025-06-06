const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Only import auth middleware where needed
const { auth } = require('../middleware/auth');

// POST /api/auth/login - NO AUTH MIDDLEWARE NEEDED
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        branch: user.branch || user.branchName || 'Head Office',
        branchName: user.branch || user.branchName || 'Head Office',
        branchCode: user.branchCode || 'HO'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me - REQUIRES AUTH MIDDLEWARE
router.get('/me', auth, async (req, res) => {
  try {
    console.log('🔍 /me endpoint hit, user from token:', req.user);
    
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      console.log('❌ User not found in database:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.username);
	
	console.log("Input password:", req.body.password);
console.log("Stored hash:", user.password);

    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        branch: user.branch || user.branchName || 'Head Office',
        branchName: user.branch || user.branchName || 'Head Office',
        branchCode: user.branchCode || 'HO'
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/register - NO AUTH MIDDLEWARE NEEDED
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, branch, displayName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      username,
      password: hashedPassword,
      role: role || 'staff',
      branch: branch || 'Head Office',
      branchName: branch || 'Head Office',
      displayName: displayName || username,
      branchCode: 'HO'
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        branch: user.branch
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;