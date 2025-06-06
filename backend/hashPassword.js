const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI; // Make sure this exists in your .env

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  // add other fields if needed
});

const User = mongoose.model('User', userSchema);

const hashPasswords = async () => {
  try {
    const users = await User.find();

    for (const user of users) {
      const isAlreadyHashed = user.password.startsWith('$2b$');

      if (!isAlreadyHashed) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
        await user.save(); // This actually updates the DB
        console.log(`✅ Hashed password for user: ${user.username}`);
      } else {
        console.log(`⏩ Already hashed: ${user.username}`);
      }
    }

    console.log('\n🎉 All applicable passwords hashed.');
  } catch (err) {
    console.error('❌ Error hashing passwords:', err);
  } finally {
    mongoose.disconnect();
  }
};

hashPasswords();
