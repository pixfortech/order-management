// userSeeder.js

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path if needed

const users = [
  {
    "username": "beadonstreet",
    "password": "beadonstreet",
    "email": "ganguramonline@gmail.com",
    "role": "staff",
    "branchName": "Beadon Street",
    "branchCode": "BD",
    "displayName": "Beadon Street Manager",
    "isActive": true,
    "createdAt": "2024-01-01 00:00:00"
  },
  {
    "username": "baranagar",
    "password": "baranagar",
    "email": "ganguramonline@gmail.com",
    "role": "staff",
    "branchName": "Baranagar",
    "branchCode": "BR",
    "displayName": "Baranagar Manager",
    "isActive": true,
    "createdAt": "2024-01-01 00:00:00"
  },
  {
    "username": "ariadaha",
    "password": "ariadaha",
    "email": "ganguramonline@gmail.com",
    "role": "staff",
    "branchName": "Ariadaha",
    "branchCode": "AR",
    "displayName": "Ariadaha Manager",
    "isActive": true,
    "createdAt": "2024-01-01 00:00:00"
  },
  {
    "username": "mistihub",
    "password": "mistihub",
    "email": "ganguramonline@gmail.com",
    "role": "staff",
    "branchName": "Misti Hub",
    "branchCode": "MH",
    "displayName": "Misti Hub Manager",
    "isActive": true,
    "createdAt": "2024-01-01 00:00:00"
  },
  {
    "username": "chowringhee",
    "password": "chowringhee",
    "email": "ganguramonline@gmail.com",
    "role": "staff",
    "branchName": "Chowringhee",
    "branchCode": "CW",
    "displayName": "Chowringhee Manager",
    "isActive": true,
    "createdAt": "2024-01-01 00:00:00"
  },
  {
    "username": "admin",
    "password": "admin",
    "email": "ganguramonline@gmail.com",
    "role": "admin",
    "branchName": "Head Office",
    "branchCode": "HO",
    "displayName": "System Administrator",
    "isActive": true,
    "createdAt": "2024-01-01 00:00:00"
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB Atlas");

    for (let user of users) {
      const existing = await User.findOne({ username: user.username });
      if (!existing) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
        await User.create(user);
        console.log(`Inserted user: ${user.username}`);
      } else {
        console.log(`User already exists: ${user.username}`);
      }
    }
    console.log("✅ All users seeded successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error inserting users:", err);
    process.exit(1);
  }
}

seedUsers();
