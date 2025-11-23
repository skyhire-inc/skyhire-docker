// interview-service/src/sockets/interviewSocket.js
const jwt = require('jsonwebtoken');

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
    console.log(`🔌 User ${socket.userId} connected to interview socket`);

    // Rejoindre une room d'interview spécifique
    socket.on('join-interview', (interviewId) => {
      socket.join(`interview-${interviewId}`);
      console.log(`User ${socket.userId} joined interview ${interviewId}`);
    });

    // Quitter une room d'interview
    socket.on('leave-interview', (interviewId) => {
      socket.leave(`interview-${interviewId}`);
      console.log(`User ${socket.userId} left interview ${interviewId}`);
    });

    // Événement de progression d'interview
    socket.on('interview-progress', (data) => {
      socket.to(`interview-${data.interviewId}`).emit('progress-update', {
        currentQuestion: data.currentQuestion,
        totalQuestions: data.totalQuestions,
        progress: data.progress
      });
    });

    // Événement de réponse soumise
    socket.on('answer-submitted', (data) => {
      socket.to(`interview-${data.interviewId}`).emit('answer-received', {
        questionIndex: data.questionIndex,
        timestamp: new Date()
      });
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      console.log(`🔌 User ${socket.userId} disconnected from interview socket`);
    });
  });
};