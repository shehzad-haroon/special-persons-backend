const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Story = require('../models/Story');
const User = require('../models/User');

const router = express.Router();

// Ensure stories directory exists
const storiesDir = path.join(__dirname, '..', 'uploads', 'stories');
if (!fs.existsSync(storiesDir)) {
  fs.mkdirSync(storiesDir, { recursive: true });
  console.log('Created stories directory');
}

// Configure multer for story uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, storiesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'story-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Create a new story
router.post('/', auth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ message: err.message });
    }
    
    try {
      const { text, backgroundColor, storyType } = req.body;
      
      console.log('Creating story with data:', { text, backgroundColor, storyType, hasFile: !!req.file });
      
      // Validate story content
      if (storyType === 'text' && !text) {
        return res.status(400).json({ message: 'Text is required for text stories' });
      }
      
      if (storyType === 'image' && !req.file) {
        return res.status(400).json({ message: 'Image is required for image stories' });
      }

      const storyData = {
        user: req.user.id,
        storyType: storyType || 'text',
        text: text || '',
        backgroundColor: backgroundColor || '#1877f2',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      if (req.file) {
        storyData.image = `/uploads/stories/${req.file.filename}`;
      }

      const story = new Story(storyData);
      await story.save();

      // Populate user info
      await story.populate('user', 'name profilePicture');

      console.log('Story created successfully:', story._id);
      res.status(201).json({
        message: 'Story created successfully',
        story
      });

    } catch (error) {
      console.error('Create story error:', error);
      res.status(500).json({ 
        message: 'Error creating story',
        error: error.message 
      });
    }
  });
});

// Get stories from user and friends
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friends');
    
    // Get IDs of user and friends
    const friendIds = user.friends.map(friend => friend._id);
    const userIds = [req.user.id, ...friendIds];

    // Find active stories (not expired)
    const stories = await Story.find({
      user: { $in: userIds },
      expiresAt: { $gt: new Date() }
    })
    .populate('user', 'name profilePicture')
    .sort({ createdAt: -1 });

    // Group stories by user
    const groupedStories = {};
    
    stories.forEach(story => {
      const userId = story.user._id.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user: story.user,
          stories: []
        };
      }
      groupedStories[userId].stories.push(story);
    });

    // Convert to array and sort by latest story
    const storyGroups = Object.values(groupedStories).sort((a, b) => {
      const latestA = new Date(Math.max(...a.stories.map(s => new Date(s.createdAt))));
      const latestB = new Date(Math.max(...b.stories.map(s => new Date(s.createdAt))));
      return latestB - latestA;
    });

    res.json({
      message: 'Stories fetched successfully',
      storyGroups
    });

  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ 
      message: 'Error fetching stories',
      error: error.message 
    });
  }
});

// Get stories for a specific user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists and is friend or self
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(req.user.id);
    const isFriend = currentUser.friends.includes(userId);
    const isSelf = userId === req.user.id;

    if (!isFriend && !isSelf) {
      return res.status(403).json({ message: 'You can only view stories from friends' });
    }

    // Find active stories for this user
    const stories = await Story.find({
      user: userId,
      expiresAt: { $gt: new Date() }
    })
    .populate('user', 'name profilePicture')
    .sort({ createdAt: 1 }); // Chronological order for viewing

    res.json({
      message: 'User stories fetched successfully',
      stories
    });

  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ 
      message: 'Error fetching user stories',
      error: error.message 
    });
  }
});

// Mark story as viewed
router.post('/:storyId/view', auth, async (req, res) => {
  try {
    const { storyId } = req.params;
    
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Add viewer if not already viewed
    if (!story.views.includes(req.user.id)) {
      story.views.push(req.user.id);
      await story.save();
    }

    res.json({
      message: 'Story marked as viewed',
      viewCount: story.views.length
    });

  } catch (error) {
    console.error('Mark story viewed error:', error);
    res.status(500).json({ 
      message: 'Error marking story as viewed',
      error: error.message 
    });
  }
});

// React to a story
router.post('/:storyId/react', auth, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { reaction } = req.body;
    
    if (!['❤️', '😂', '😮', '😢', '😡', '👍'].includes(reaction)) {
      return res.status(400).json({ message: 'Invalid reaction' });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user already reacted
    const existingReaction = story.reactions.find(
      r => r.user.toString() === req.user.id
    );

    if (existingReaction) {
      existingReaction.reaction = reaction;
    } else {
      story.reactions.push({
        user: req.user.id,
        reaction
      });
    }

    await story.save();

    res.json({
      message: 'Reaction added successfully',
      reactions: story.reactions
    });

  } catch (error) {
    console.error('React to story error:', error);
    res.status(500).json({ 
      message: 'Error reacting to story',
      error: error.message 
    });
  }
});

// Delete a story (only by owner)
router.delete('/:storyId', auth, async (req, res) => {
  try {
    const { storyId } = req.params;
    
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user owns the story
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own stories' });
    }

    await Story.findByIdAndDelete(storyId);

    res.json({
      message: 'Story deleted successfully'
    });

  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ 
      message: 'Error deleting story',
      error: error.message 
    });
  }
});

// Clean up expired stories (utility endpoint)
router.delete('/cleanup/expired', auth, async (req, res) => {
  try {
    // Only allow admins or system to call this
    const result = await Story.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    res.json({
      message: 'Expired stories cleaned up',
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Cleanup expired stories error:', error);
    res.status(500).json({ 
      message: 'Error cleaning up expired stories',
      error: error.message 
    });
  }
});

module.exports = router;