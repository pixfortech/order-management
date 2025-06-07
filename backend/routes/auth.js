const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { auth: authenticateToken } = require("../middleware/auth");

const router = express.Router();

// ✅ POST /api/auth/login (with debug logging)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', { username, passwordProvided: !!password });

    // Check if username and password are provided
    if (!username || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ message: "Username and password are required" });
    }

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
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });

    // Compare password
    console.log('🔒 Comparing passwords...');
    console.log('Plain password:', password);
    console.log('Hashed password:', user.password);
    
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔓 Password match result:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ message: "Invalid credentials: wrong password" });
    }

    // Sign JWT token
    console.log('🎫 Creating JWT token...');
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log('✅ Login successful for:', username);
    res.status(200).json({ token, user });
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