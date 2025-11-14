const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => console.error('MongoDB connection error:', err));

async function seedDatabase() {
  try {
    // Create some sample users
    const user1 = new User({
      name: 'Ali Ahmed',
      email: 'ali@example.com',
      password: 'hashedpassword123',
      disability: 'Visual impairment'
    });
    
    const user2 = new User({
      name: 'Sara Khan',
      email: 'sara@example.com', 
      password: 'hashedpassword123',
      disability: 'Hearing impairment'
    });

    await user1.save();
    await user2.save();

    // Create sample posts
    const post1 = new Post({
      author: user1._id,
      content: 'Hello everyone! This is my first post on Special Persons network. Happy to be here! 😊',
      createdAt: new Date()
    });

    const post2 = new Post({
      author: user2._id,
      content: 'Just wanted to share my experience using screen reader technology. It has made my life so much easier! 💻',
      createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
    });

    const post3 = new Post({
      author: user1._id,
      content: 'Beautiful sunset today! Nature is amazing for everyone to enjoy. 🌅',
      createdAt: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
    });

    await post1.save();
    await post2.save();
    await post3.save();

    console.log('Sample data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();