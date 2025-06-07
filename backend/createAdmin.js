const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if needed

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name');

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists. Deleting...');
      await User.deleteOne({ username: 'admin' });
    }
    
    // Create new admin user
    const adminUser = new User({
      username: 'admin',
      password: 'admin123', // This will be hashed by the pre-save hook
      displayName: 'Administrator',
      branchName: 'Head Office',
      branchCode: 'HO',
      role: 'admin',
      email: 'admin@company.com'
    });
    
    await adminUser.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('👤 Username: admin');
    console.log('🔑 Password: admin123');
    console.log('🏢 Branch: Head Office');
    console.log('👑 Role: admin');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();