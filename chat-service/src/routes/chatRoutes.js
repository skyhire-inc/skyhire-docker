const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
  markAsRead,
  getChatStats
} = require('../controllers/chatController');

const router = express.Router();

// Toutes les routes protégées
router.use(protect);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations', startConversation);
router.patch('/conversations/:id/read', markAsRead);
router.get('/stats', getChatStats);

module.exports = router;