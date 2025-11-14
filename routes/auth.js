const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
function auth(req, res, next) {
  let token = req.headers['authorization'];
  console.log('Auth middleware - Original token:', token ? 'Present' : 'Missing');
  
  // Handle both formats: "Bearer token" and "token"
  if (token && token.startsWith('Bearer ')) {
    token = token.replace('Bearer ', '');
  }
  
  console.log('Auth middleware - Processed token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully, userId:', decoded.userId);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, disability } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, disability });
    await user.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, disability: user.disability } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password route
router.put('/change-password', auth, async (req, res) => {
  try {
    console.log('Password change request received');
    console.log('User ID:', req.userId);
    console.log('Request body:', { ...req.body, currentPassword: '***', newPassword: '***' });
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      console.log('Missing password fields');
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      console.log('User not found:', req.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User found, checking current password');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log('Current password incorrect');
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    console.log('Current password verified, updating password');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.userId, { password: hashedPassword });
    
    console.log('Password updated successfully');
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
