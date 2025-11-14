// Special Persons Backend - Production Ready
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  }
});

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/stories', require('./routes/stories'));

// Static files with absolute path
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test direct image access
app.get('/test-direct-image', (req, res) => {
  const imagePath = path.join(__dirname, 'uploads', '1762536263301.jpg');
  res.sendFile(imagePath);
});

// Test route for debugging
app.get('/test-image', (req, res) => {
  const fs = require('fs');
  const uploadsPath = path.join(__dirname, 'uploads');
  try {
    const files = fs.readdirSync(uploadsPath);
    res.json({
      message: 'Server running',
      uploadsPath: uploadsPath,
      files: files,
      staticServing: '/uploads mapped to ' + uploadsPath,
      testImageExists: fs.existsSync(path.join(uploadsPath, '1762536263301.jpg'))
    });
  } catch (error) {
    res.json({
      message: 'Error reading uploads directory',
      error: error.message,
      uploadsPath: uploadsPath
    });
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 5000;

// Socket.io connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Authenticate socket connection
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.join(`user_${decoded.userId}`);
      connectedUsers.set(decoded.userId, socket.id);
      
      // Broadcast online status
      socket.broadcast.emit('user_online', decoded.userId);
      console.log(`User ${decoded.userId} authenticated and joined room`);
    } catch (error) {
      socket.emit('auth_error', 'Invalid token');
    }
  });
  
  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(`user_${data.receiverId}`).emit('user_typing', {
      senderId: socket.userId,
      isTyping: data.isTyping
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      socket.broadcast.emit('user_offline', socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
