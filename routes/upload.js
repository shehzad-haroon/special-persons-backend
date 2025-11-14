const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

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

router.post('/profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    // Store path without leading slash - let frontend handle URL construction
    const profilePicturePath = `uploads/${req.file.filename}`;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profilePicture: profilePicturePath },
      { new: true }
    ).select('-password');
    
    console.log('Profile picture uploaded:', profilePicturePath);
    res.json(user);
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
