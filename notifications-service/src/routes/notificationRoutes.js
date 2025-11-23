const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationStats
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes protégées
router.use(protect);

router.get('/', getNotifications);
router.get('/stats', getNotificationStats);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

// Route pour création par d'autres services (avec auth spéciale si besoin)
router.post('/', createNotification);

module.exports = router;