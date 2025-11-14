const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const auth = require('../middleware/auth'); // Use centralized auth

// Send friend request (updated endpoint)
router.post('/add', auth, async (req, res) => {
  try {
    const { friendId } = req.body;
    
    // Check if user exists
    const receiver = await User.findById(friendId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Can't send friend request to yourself
    if (friendId === req.userId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }
    
    // Check if already friends
    const sender = await User.findById(req.userId);
    if (sender.friends.includes(friendId)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    
    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: req.userId, receiver: friendId },
        { sender: friendId, receiver: req.userId }
      ]
    });
    
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already exists' });
    }
    
    // Create friend request
    const friendRequest = new FriendRequest({
      sender: req.userId,
      receiver: friendId
    });
    
    await friendRequest.save();
    await friendRequest.populate('sender', 'name profilePicture');
    
    res.json({ message: 'Friend request sent', friendRequest });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request (legacy endpoint)
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const receiver = await User.findById(userId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Can't send friend request to yourself
    if (userId === req.userId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }
    
    // Check if already friends
    const sender = await User.findById(req.userId);
    if (sender.friends.includes(userId)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    
    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId }
      ]
    });
    
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already exists' });
    }
    
    // Create friend request
    const friendRequest = new FriendRequest({
      sender: req.userId,
      receiver: userId
    });
    
    await friendRequest.save();
    await friendRequest.populate('sender', 'name profilePicture');
    
    res.json({ message: 'Friend request sent', friendRequest });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request
router.post('/accept/:requestId', auth, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.requestId);
    
    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    if (friendRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Friend request already processed' });
    }
    
    // Update friend request status
    friendRequest.status = 'accepted';
    await friendRequest.save();
    
    // Add each other as friends
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.receiver }
    });
    
    await User.findByIdAndUpdate(friendRequest.receiver, {
      $addToSet: { friends: friendRequest.sender }
    });
    
    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject friend request
router.post('/reject/:requestId', auth, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.requestId);
    
    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    if (friendRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    friendRequest.status = 'rejected';
    await friendRequest.save();
    
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend requests (received)
router.get('/requests', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.userId,
      status: 'pending'
    }).populate('sender', 'name profilePicture disability');
    
    res.json(requests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends list
router.get('/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('friends', 'name profilePicture disability')
      .select('friends');
    
    res.json(user.friends);
  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend suggestions (smart suggestions based on mutual friends, interests, etc.)
router.get('/suggestions', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select('friends disability interests');
    const friendIds = currentUser.friends.map(id => id.toString());
    
    // Get pending friend requests to exclude them
    const pendingRequests = await FriendRequest.find({
      $or: [
        { sender: req.userId, status: 'pending' },
        { receiver: req.userId, status: 'pending' }
      ]
    });
    
    const requestUserIds = pendingRequests.map(req => 
      req.sender.toString() === req.userId ? req.receiver.toString() : req.sender.toString()
    );
    
    // Find users who are not friends and don't have pending requests
    let suggestions = await User.find({
      _id: { 
        $nin: [req.userId, ...friendIds, ...requestUserIds] 
      }
    }).select('name profilePicture disability interests').limit(20);
    
    // Sort suggestions by relevance (same disability type, mutual friends, etc.)
    suggestions = suggestions.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // Higher score for same disability type
      if (currentUser.disability && a.disability === currentUser.disability) scoreA += 5;
      if (currentUser.disability && b.disability === currentUser.disability) scoreB += 5;
      
      // Higher score for similar interests (if implemented)
      // You can expand this later with interest matching
      
      return scoreB - scoreA;
    });
    
    res.json(suggestions.slice(0, 10)); // Return top 10 suggestions
  } catch (error) {
    console.error('Get friend suggestions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get non-friends (fallback for suggestions)
router.get('/non-friends', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select('friends');
    const friendIds = currentUser.friends.map(id => id.toString());
    
    const nonFriends = await User.find({
      _id: { 
        $nin: [req.userId, ...friendIds] 
      }
    }).select('name profilePicture disability').limit(10);
    
    res.json(nonFriends);
  } catch (error) {
    console.error('Get non-friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check friendship status
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if already friends
    const currentUser = await User.findById(req.userId).select('friends');
    if (currentUser.friends.includes(userId)) {
      return res.json({ status: 'friends' });
    }
    
    // Check if friend request exists
    const friendRequest = await FriendRequest.findOne({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId }
      ]
    });
    
    if (friendRequest) {
      if (friendRequest.sender.toString() === req.userId) {
        return res.json({ status: 'sent', requestId: friendRequest._id });
      } else {
        return res.json({ status: 'received', requestId: friendRequest._id });
      }
    }
    
    res.json({ status: 'none' });
  } catch (error) {
    console.error('Check friendship status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;