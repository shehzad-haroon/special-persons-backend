const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  let token = req.headers['authorization'];
  console.log('Middleware auth - Original token:', token ? 'Present' : 'Missing');
  
  // Handle both formats: "Bearer token" and "token"
  if (token && token.startsWith('Bearer ')) {
    token = token.replace('Bearer ', '');
  }
  
  console.log('Middleware auth - Processed token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully, userId:', decoded.userId);
    req.user = { id: decoded.userId };
    req.userId = decoded.userId; // Keep for backward compatibility
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = auth;