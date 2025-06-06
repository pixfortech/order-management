const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      console.warn('❌ User not found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.warn('❌ Incorrect password for user:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

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
    console.error('🔥 Login error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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
    console.error('🔥 /me error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, branch, displayName } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

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
    console.error('🔥 Register error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
