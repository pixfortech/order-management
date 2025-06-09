// Replace your middleware/auth.js with this:

const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Add this import

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ FIXED: Fetch complete user data from database instead of just using JWT payload
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // ✅ FIXED: Include complete user data with branch information
    req.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      branchCode: user.branchCode,
      branchName: user.branchName,
      email: user.email,
      displayName: user.displayName
    };
    
    console.log('🔍 Auth middleware - User data:', {
      username: req.user.username,
      role: req.user.role,
      branchCode: req.user.branchCode,
      branchName: req.user.branchName
    });
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { auth, adminOnly };