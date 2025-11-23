// chat-service/src/sockets/chatSocket.js
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

module.exports = (io) => {
  io.use((socket, next) => {
    // Authentification via token JWT
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.userId} connected to chat`);

    // Rejoindre les conversations de l'utilisateur
    socket.on('join-conversations', async () => {
      try {
        const conversations = await Conversation.find({
          participants: { $elemMatch: { userId: socket.userId } },
          isActive: true
        });

        conversations.forEach(conversation => {
          socket.join(`conversation-${conversation._id}`);
        });

        console.log(`User ${socket.userId} joined ${conversations.length} conversations`);
      } catch (error) {
        console.error('Join conversations error:', error);
      }
    });

    // Rejoindre une conversation spécifique
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation-${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    // Quitter une conversation
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation-${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Événement de frappe en cours
    socket.on('typing-start', (data) => {
      socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
        isTyping: false
      });
    });

    // Événement de message lu
    socket.on('message-read', async (data) => {
      try {
        await Message.findByIdAndUpdate(data.messageId, {
          $addToSet: {
            readBy: {
              userId: socket.userId,
              readAt: new Date()
            }
          }
        });

        socket.to(`conversation-${data.conversationId}`).emit('message-read-update', {
          messageId: data.messageId,
          userId: socket.userId,
          conversationId: data.conversationId
        });
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Événement de connexion/déconnexion
    socket.on('user-online', () => {
      socket.broadcast.emit('user-status', {
        userId: socket.userId,
        status: 'online',
        lastSeen: new Date()
      });
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      console.log(`🔌 User ${socket.userId} disconnected from chat`);
      
      socket.broadcast.emit('user-status', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date()
      });
    });
  });
};