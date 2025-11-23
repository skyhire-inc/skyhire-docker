// chat-service/src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// 🔥 IMPORTANT : Stocker io dans app pour y accéder dans les controllers
app.set('io', io);

// Routes
app.use('/api/chat', require('./routes/chatRoutes'));

// Socket.io
require('./sockets/chatSocket')(io);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Chat Service',
    timestamp: new Date() 
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skyhire-chat')
  .then(() => console.log('✅ Chat Service connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const PORT = process.env.PORT || 5006;
server.listen(PORT, () => {
  console.log(`🚀 Chat Service running on port ${PORT}`);
});