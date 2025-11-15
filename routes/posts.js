const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const jwt = require('jsonwebtoken');

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const postsDir = path.join(uploadsDir, 'posts');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

// Multer setup for post images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'), false);
    }
  }
});

// Auth middleware
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Create post
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
      const { content } = req.body;
      
      if (!content && !req.file) {
        return res.status(400).json({ message: 'Post must have content or image' });
      }
      
      const post = new Post({
        author: req.userId,
        content: content || '',
        image: req.file ? `uploads/posts/${req.file.filename}` : null
      });
      
      await post.save();
      await post.populate('author', 'name profilePicture');
      
      console.log('Post created successfully:', post._id);
      res.status(201).json(post);
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
});

// Get all posts (feed)
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name profilePicture')
      .populate('comments.author', 'name profilePicture')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/unlike post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    const likeIndex = post.likes.indexOf(req.userId);
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1); // Unlike
    } else {
      post.likes.push(req.userId); // Like
    }
    
    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    post.comments.push({
      author: req.userId,
      content
    });
    
    await post.save();
    
    // Populate all necessary fields for frontend
    await post.populate([
      { path: 'author', select: 'name profilePicture' },
      { path: 'comments.author', select: 'name profilePicture' }
    ]);
    
    res.json(post);
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;