const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

// Get chat history between two users
router.get('/history/:friendId', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    // Verify friendship
    const currentUser = await User.findById(req.userId);
    if (!currentUser.friends.includes(friendId)) {
      return res.status(403).json({ message: 'Can only chat with friends' });
    }
    
    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: friendId },
        { sender: friendId, receiver: req.userId }
      ]
    })
    .populate('sender', 'name profilePicture')
    .populate('receiver', 'name profilePicture')
    .sort({ createdAt: 1 })
    .limit(100); // Last 100 messages
    
    res.json(messages);
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text' } = req.body;
    
    // Verify friendship
    const currentUser = await User.findById(req.userId);
    if (!currentUser.friends.includes(receiverId)) {
      return res.status(403).json({ message: 'Can only message friends' });
    }
    
    const message = new Message({
      sender: req.userId,
      receiver: receiverId,
      content,
      messageType
    });
    
    await message.save();
    await message.populate([
      { path: 'sender', select: 'name profilePicture' },
      { path: 'receiver', select: 'name profilePicture' }
    ]);
    
    // Emit real-time message via Socket.io
    req.io.to(`user_${receiverId}`).emit('new_message', message);
    req.io.to(`user_${req.userId}`).emit('message_sent', message);
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat list (all friends with latest message)
router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).populate('friends', 'name profilePicture');
    
    const conversations = await Promise.all(
      currentUser.friends.map(async (friend) => {
        // Get latest message between current user and this friend
        const latestMessage = await Message.findOne({
          $or: [
            { sender: req.userId, receiver: friend._id },
            { sender: friend._id, receiver: req.userId }
          ]
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'name');
        
        // Count unread messages
        const unreadCount = await Message.countDocuments({
          sender: friend._id,
          receiver: req.userId,
          status: { $ne: 'read' }
        });
        
        return {
          friend,
          latestMessage,
          unreadCount
        };
      })
    );
    
    // Sort by latest message time
    conversations.sort((a, b) => {
      if (!a.latestMessage && !b.latestMessage) return 0;
      if (!a.latestMessage) return 1;
      if (!b.latestMessage) return -1;
      return new Date(b.latestMessage.createdAt) - new Date(a.latestMessage.createdAt);
    });
    
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.post('/mark-read/:friendId', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    await Message.updateMany(
      {
        sender: friendId,
        receiver: req.userId,
        status: { $ne: 'read' }
      },
      { status: 'read' }
    );
    
    // Notify sender that messages were read
    req.io.to(`user_${friendId}`).emit('messages_read', {
      readBy: req.userId,
      chatPartner: friendId
    });
    
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;