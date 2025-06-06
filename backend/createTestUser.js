require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const createTestUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findOne({ username: "admin" });
    if (existing) {
      await User.deleteOne({ username: "admin" });
      console.log("Previous 'admin' user deleted");
    }

    const hashedPassword = await bcrypt.hash("admin", 10);

    const newUser = new User({
      username: "admin",
      password: hashedPassword,
      email: "ganguramonline@gmail.com",
      role: "admin",
      branch: "Head Office",
      branchName: "Head Office",
      branchCode: "HO",
      displayName: "System Administrator",
      isActive: true,
    });

    await newUser.save();
    console.log("✅ Admin user created successfully");

    mongoose.disconnect();
  } catch (err) {
    console.error("🔥 Error:", err.message);
    mongoose.disconnect();
  }
};

createTestUser();
