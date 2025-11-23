// user-service/src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Debug route pour tester l'authentification
app.get('/api/debug/auth', (req, res) => {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
  
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.json({ error: 'No token provided', headers: req.headers });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ 
      success: true, 
      decoded,
      JWT_SECRET_PREVIEW: JWT_SECRET.substring(0, 20) + '...',
      token_preview: token.substring(0, 30) + '...'
    });
  } catch (error) {
    res.json({ 
      error: error.message, 
      JWT_SECRET_PREVIEW: JWT_SECRET.substring(0, 20) + '...',
      token_preview: token ? token.substring(0, 30) + '...' : 'none'
    });
  }
});

// Routes
app.use('/api/users', require('./routes/userRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'User Service',
    timestamp: new Date() 
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skyhire-users')
  .then(() => console.log('✅ User Service connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`🚀 User Service running on port ${PORT}`);
});