// freshUserSeeder.js - Fixed version that works with User model pre-save middleware
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path if needed

const users = [
  {
    username: "admin",
    password: "admin", // Plain text - will be hashed by User model
    email: "ganguramonline@gmail.com",
    role: "admin",
    branchName: "Head Office",
    branchCode: "HO",
    displayName: "System Administrator",
    isActive: true
  },
  {
    username: "ariadaha",
    password: "ariadaha", // Plain text - will be hashed by User model
    email: "ganguramonline@gmail.com",
    role: "staff",
    branchName: "Ariadaha",
    branchCode: "AR",
    displayName: "Ariadaha Manager",
    isActive: true
  },
  {
    username: "baranagar", 
    password: "baranagar", // Plain text - will be hashed by User model
    email: "ganguramonline@gmail.com",
    role: "staff",
    branchName: "Baranagar",
    branchCode: "BR",
    displayName: "Baranagar Manager",
    isActive: true
  },
  {
    username: "beadonstreet",
    password: "beadonstreet", // Plain text - will be hashed by User model
    email: "ganguramonline@gmail.com",
    role: "staff",
    branchName: "Beadon Street",
    branchCode: "BD",
    displayName: "Beadon Street Manager",
    isActive: true
  },
  {
    username: "chowringhee",
    password: "chowringhee", // Plain text - will be hashed by User model
    email: "ganguramonline@gmail.com", 
    role: "staff",
    branchName: "Chowringhee",
    branchCode: "CW",
    displayName: "Chowringhee Manager",
    isActive: true
  },
  {
    username: "mistihub",
    password: "mistihub", // Plain text - will be hashed by User model
    email: "ganguramonline@gmail.com",
    role: "staff", 
    branchName: "Misti Hub",
    branchCode: "MH",
    displayName: "Misti Hub Manager",
    isActive: true
  }
];

async function resetAndCreateUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("🔗 Connected to MongoDB Atlas");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);

    // Step 1: Delete ALL existing users
    console.log("\n🗑️  Deleting all existing users...");
    const deleteResult = await User.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing users`);

    // Step 2: Create fresh users (passwords will be auto-hashed by User model)
    console.log("\n👥 Creating fresh users...");
    
    for (const userData of users) {
      try {
        // Create user - password will be automatically hashed by the User model's pre-save middleware
        const newUser = new User({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newUser.save(); // This triggers the pre-save middleware to hash the password
        console.log(`✅ Created user: ${userData.username} (${userData.role})`);
        
        // Verify the user was created and password was hashed
        const savedUser = await User.findOne({ username: userData.username });
        const isHashed = savedUser.password.startsWith('$2b$');
        console.log(`   🔍 Verified: ${savedUser.username} - Password hashed: ${isHashed ? 'YES' : 'NO'}`);
        
      } catch (userError) {
        console.error(`❌ Error creating user ${userData.username}:`, userError.message);
      }
    }

    // Step 3: Final verification
    console.log("\n🔍 Final verification:");
    const allUsers = await User.find({}).select('username role branchName');
    console.log(`📊 Total users created: ${allUsers.length}`);
    
    allUsers.forEach(user => {
      console.log(`   👤 ${user.username} (${user.role}) - ${user.branchName}`);
    });

    // Step 4: Test password verification for admin (this is the crucial test)
    console.log("\n🔐 Testing password verification for admin user:");
    const adminUser = await User.findOne({ username: 'admin' });
    if (adminUser) {
      const isValidPassword = await bcrypt.compare('admin', adminUser.password);
      console.log(`   ✅ Admin password verification: ${isValidPassword ? 'SUCCESS ✅' : 'FAILED ❌'}`);
      
      // Additional debug info
      console.log(`   🔍 Admin password hash: ${adminUser.password.substring(0, 20)}...`);
      console.log(`   🔍 Hash length: ${adminUser.password.length}`);
    }

    // Step 5: Test all users
    console.log("\n🔐 Testing all user passwords:");
    for (const userData of users) {
      const user = await User.findOne({ username: userData.username });
      if (user) {
        const isValid = await bcrypt.compare(userData.password, user.password);
        console.log(`   ${isValid ? '✅' : '❌'} ${userData.username}: ${isValid ? 'SUCCESS' : 'FAILED'}`);
      }
    }

    console.log("\n🎉 User reset and creation completed!");
    console.log("\n📋 Login credentials (try these now):");
    users.forEach(user => {
      console.log(`   ${user.username} | ${user.password}`);
    });

  } catch (error) {
    console.error("❌ Error during user reset:", error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the function
resetAndCreateUsers();