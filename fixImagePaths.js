const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function fixImagePaths() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const User = require('./models/User');
    
    // Update users with old path format
    const result = await User.updateMany(
      { profilePicture: { $regex: '^/uploads/' } },
      [{ $set: { profilePicture: { $substr: ['$profilePicture', 1, -1] } } }]
    );
    
    console.log('Updated users:', result.modifiedCount);

    const Post = require('./models/Post');
    
    // Update posts with old path format
    const postResult = await Post.updateMany(
      { image: { $regex: '^/uploads/' } },
      [{ $set: { image: { $substr: ['$image', 1, -1] } } }]
    );
    
    console.log('Updated posts:', postResult.modifiedCount);
    
    mongoose.disconnect();
    console.log('Database paths fixed!');
  } catch (error) {
    console.error('Error fixing paths:', error);
  }
}

fixImagePaths();