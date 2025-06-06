// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`🔐 Login attempt for username: ${username}`);

  try {
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`❌ User ${username} not found`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ Password mismatch for user: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ Login successful for: ${username}`);
    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        branchName: user.branchName,
        branchCode: user.branchCode,
        role: user.role
      }
    });
  } catch (error) {
    console.error('💥 Login error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
