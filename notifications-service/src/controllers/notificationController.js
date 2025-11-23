const Notification = require('../models/Notification');
const { getUserInfo } = require('../services/userService');

// Obtenir les notifications de l'utilisateur
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    let query = { userId: req.user.id };
    
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.id, 
      read: false 
    });

    res.json({
      status: 'success',
      data: {
        notifications,
        stats: {
          total,
          unread: unreadCount
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notifications'
    });
  }
};

// Marquer une notification comme lue
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
};

// Marquer toutes les notifications comme lues
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );

    res.json({
      status: 'success',
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read'
    });
  }
};

// Supprimer une notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification'
    });
  }
};

// Créer une notification (pour usage interne par d'autres services)
const createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, data, priority } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, type, title, and message are required'
      });
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data: data || {},
      priority: priority || 'medium'
    });

    res.status(201).json({
      status: 'success',
      data: {
        notification
      }
    });

    // 🔥 Ici on pourrait émettre un événement WebSocket pour les notifications en temps réel
    // req.app.get('io')?.to(`user-${userId}`).emit('new-notification', { notification });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create notification'
    });
  }
};

// Obtenir les statistiques des notifications
const getNotificationStats = async (req, res) => {
  try {
    const total = await Notification.countDocuments({ userId: req.user.id });
    const unread = await Notification.countDocuments({ 
      userId: req.user.id, 
      read: false 
    });
    
    const byType = await Notification.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      status: 'success',
      data: {
        stats: {
          total,
          unread,
          byType
        }
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notification stats'
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationStats
};