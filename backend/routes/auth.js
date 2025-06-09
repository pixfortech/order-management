const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');
const User = require("../models/User");
const { auth: authenticateToken } = require("../middleware/auth");

const router = express.Router();

// In your routes/auth.js, replace the login route with this:

// ✅ POST /api/auth/login (with branch data)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', { username, passwordProvided: !!password });

    // Check if username and password are provided
    if (!username || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Add this debug code in auth.js after line 15
    console.log('🔍 Database name:', mongoose.connection.db.databaseName);
    console.log('🔍 Connection state:', mongoose.connection.readyState);

    // Check if we can find ANY users
    const allUsers = await User.find({}).limit(3);
    console.log('📊 All users found:', allUsers.map(u => u.username));

    // Find user
    console.log('🔍 Searching for user:', username);
    const user = await User.findOne({ username });
    console.log('👤 User found:', !!user);
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ message: "Invalid credentials: user not found" });
    }

    console.log('🗝️ User details:', {
      username: user.username,
      role: user.role,
      branchCode: user.branchCode, // ✅ ADDED: Log branch info
      branchName: user.branchName, // ✅ ADDED: Log branch info
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });

    // Compare password
    console.log('🔒 Comparing passwords...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔓 Password match result:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ message: "Invalid credentials: wrong password" });
    }

    // ✅ FIXED: Include branch information in JWT token
    console.log('🎫 Creating JWT token with branch data...');
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        role: user.role,
        branchCode: user.branchCode, // ✅ ADDED: Include branch code
        branchName: user.branchName  // ✅ ADDED: Include branch name
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // ✅ FIXED: Return complete user data
    const userData = {
      id: user._id,
      username: user.username,
      role: user.role,
      branchCode: user.branchCode,
      branchName: user.branchName,
      email: user.email,
      displayName: user.displayName
    };

    console.log('✅ Login successful for:', username, 'Branch:', user.branchCode);
    res.status(200).json({ token, user: userData });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ GET /api/auth/me (protected)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Fetch Me Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;