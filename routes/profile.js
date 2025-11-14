const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
function auth(req, res, next) {
  let token = req.headers['authorization'];
  console.log('Profile auth middleware - Original token:', token ? 'Present' : 'Missing');
  
  // Handle both formats: "Bearer token" and "token"
  if (token && token.startsWith('Bearer ')) {
    token = token.replace('Bearer ', '');
  }
  
  console.log('Profile auth middleware - Processed token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    console.log('No token provided in profile route');
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Profile token decoded successfully, userId:', decoded.userId);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.log('Profile token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Get profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/', auth, async (req, res) => {
  try {
    const { name, disability } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, disability },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile for settings
router.put('/update', auth, async (req, res) => {
  try {
    console.log('Profile update request received');
    console.log('User ID:', req.userId);
    console.log('Request body:', req.body);
    
    const { name, bio, privacy } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (privacy) updateData.privacy = privacy;
    
    console.log('Update data:', updateData);
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true }
    ).select('-password');
    
    console.log('Updated user:', user);
    
    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
