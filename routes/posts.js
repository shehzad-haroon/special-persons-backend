const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const jwt = require('jsonwebtoken');

// Multer setup for post images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/posts/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

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
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { content } = req.body;
    const post = new Post({
      author: req.userId,
      content,
      image: req.file ? `uploads/posts/${req.file.filename}` : null
    });
    await post.save();
    await post.populate('author', 'name profilePicture');
    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
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