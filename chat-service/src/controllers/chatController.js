// chat-service/src/controllers/chatController.js
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { getMultipleUsersInfo, getUserInfo, getUserPrefs } = require('../services/userService');

const axios = require('axios');
const NOTIF_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:5007';

// Obtenir les conversations de l'utilisateur
const getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      participants: { $elemMatch: { userId: req.user.id } },
      isActive: true
    })
    .sort({ 'lastMessage.timestamp': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Récupérer tous les user IDs de toutes les conversations
    const allUserIds = new Set();
    conversations.forEach(conv => {
      conv.participants.forEach(participant => {
        allUserIds.add(participant.userId.toString());
      });
      if (conv.lastMessage && conv.lastMessage.sender) {
        allUserIds.add(conv.lastMessage.sender.toString());
      }
    });

    // Récupérer les infos utilisateurs via API
    const authToken = req.headers.authorization;
    const usersMap = await getMultipleUsersInfo(Array.from(allUserIds), authToken);

    // Compute per-user unread counts
    const unreadCounts = await Promise.all(conversations.map(async (conv) => {
      const me = req.user.id.toString();
      const meParticipant = conv.participants.find(p => p.userId.toString() === me);
      const lastReadAt = meParticipant?.lastRead || new Date(0);
      const count = await Message.countDocuments({
        conversationId: conv._id,
        isDeleted: false,
        createdAt: { $gt: lastReadAt },
        sender: { $ne: req.user.id }
      });
      return count;
    }));

    // Formater les conversations avec les données utilisateur
    const formattedConversations = conversations.map((conv, idx) => ({
      _id: conv._id,
      participants: conv.participants.map(participant => ({
        userId: participant.userId,
        lastRead: participant.lastRead,
        user: usersMap[participant.userId.toString()] || {
          _id: participant.userId,
          name: 'Unknown User',
          avatar: null,
          role: 'candidate'
        }
      })),
      type: conv.type,
      title: conv.title,
      lastMessage: conv.lastMessage ? {
        content: conv.lastMessage.content,
        sender: usersMap[conv.lastMessage.sender.toString()] || {
          _id: conv.lastMessage.sender,
          name: 'Unknown User',
          avatar: null
        },
        timestamp: conv.lastMessage.timestamp,
        type: conv.lastMessage.type
      } : null,
      unreadCount: unreadCounts[idx] || 0,
      isActive: conv.isActive,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    const total = await Conversation.countDocuments({
      participants: { $elemMatch: { userId: req.user.id } },
      isActive: true
    });

    res.json({
      status: 'success',
      data: {
        conversations: formattedConversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get conversations'
    });
  }
};

// Obtenir les messages d'une conversation
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: { $elemMatch: { userId: req.user.id } }
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    const messages = await Message.find({
      conversationId: id,
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Récupérer tous les user IDs des messages
    const allUserIds = new Set();
    messages.forEach(message => {
      allUserIds.add(message.sender.toString());
      if (message.replyTo) {
        allUserIds.add(message.replyTo.sender?.toString());
      }
    });

    // Récupérer les infos utilisateurs via API
    const authToken = req.headers.authorization;
    const usersMap = await getMultipleUsersInfo(Array.from(allUserIds), authToken);

    // Formater les messages avec les données utilisateur
    const formattedMessages = messages.map(message => ({
      _id: message._id,
      conversationId: message.conversationId,
      sender: usersMap[message.sender.toString()] || {
        _id: message.sender,
        name: 'Unknown User',
        avatar: null
      },
      content: message.content,
      type: message.type,
      attachments: message.attachments,
      readBy: message.readBy,
      reactions: message.reactions,
      replyTo: message.replyTo ? {
        _id: message.replyTo._id,
        content: message.replyTo.content,
        sender: usersMap[message.replyTo.sender?.toString()] || {
          _id: message.replyTo.sender,
          name: 'Unknown User'
        }
      } : null,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    }));

    const total = await Message.countDocuments({
      conversationId: id,
      isDeleted: false
    });

    // Marquer les messages comme lus
    await Conversation.updateOne(
      { 
        _id: id,
        'participants.userId': req.user.id 
      },
      { 
        $set: { 'participants.$.lastRead': new Date() }
      }
    );

    res.json({
      status: 'success',
      data: {
        messages: formattedMessages.reverse(), // Plus ancien au plus récent
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get messages'
    });
  }
};

// Envoyer un message
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', attachments = [], replyTo } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content or attachments are required'
      });
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: { $elemMatch: { userId: req.user.id } }
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    // Créer le message
    const message = await Message.create({
      conversationId: id,
      sender: req.user.id,
      content,
      type,
      attachments,
      replyTo,
      readBy: [{
        userId: req.user.id,
        readAt: new Date()
      }]
    });

    // Mettre à jour la conversation (ne pas modifier unreadCount global)
    await Conversation.findByIdAndUpdate(id, {
      lastMessage: {
        content: content || 'Attachment',
        sender: req.user.id,
        timestamp: new Date(),
        type
      }
    });

    // Récupérer les infos de l'expéditeur via API
    const authToken = req.headers.authorization;
    const senderInfo = await getUserInfo(req.user.id, authToken);

    // Formater le message pour la réponse
    const formattedMessage = {
      _id: message._id,
      conversationId: message.conversationId,
      sender: senderInfo,
      content: message.content,
      type: message.type,
      attachments: message.attachments,
      readBy: message.readBy,
      reactions: message.reactions,
      replyTo: message.replyTo,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };

    res.status(201).json({
      status: 'success',
      data: {
        message: formattedMessage
      }
    });

    // 🔥 CORRECTION : Vérifier que Socket.io est disponible avant d'émettre
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation-${id}`).emit('new-message', {
          conversationId: id,
          message: formattedMessage
        });
        console.log(`📢 [SOCKET] Message emitted to conversation-${id}`);
      } else {
        console.log('🟡 [SOCKET] Socket.io not available, message saved but not emitted');
      }
    } catch (socketError) {
      console.error('🔴 [SOCKET] Error emitting message:', socketError);
      // Ne pas crash l'API à cause d'une erreur socket
    }

    // Notifications pour les autres participants (respecter les préférences)
    try {
      const others = (conversation.participants || []).filter(p => String(p.userId) !== String(req.user.id));
      const preview = (content || 'Attachment').slice(0, 140);
      const authHeader = req.headers.authorization || '';
      await Promise.all(others.map(async (p) => {
        const prefs = await getUserPrefs(p.userId, authHeader);
        if (prefs && prefs.message === false) return;
        await axios.post(`${NOTIF_URL}/api/notifications`, {
          userId: p.userId,
          type: 'message',
          title: 'New message',
          message: preview,
          data: { conversationId: id, senderId: req.user.id }
        }, {
          headers: { Authorization: authHeader },
          timeout: 5000,
        });
      }));
    } catch (notifyErr) {
      console.error('Failed to create message notification:', notifyErr?.message);
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send message'
    });
  }
};

// Démarrer une nouvelle conversation
const startConversation = async (req, res) => {
  try {
    let { participantIds, title, type = 'direct' } = req.body;

    console.log('🔍 Participant IDs reçus:', participantIds);

    // Convertir en tableau si c'est une string
    if (typeof participantIds === 'string') {
      participantIds = [participantIds];
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'participantIds must be a non-empty array'
      });
    }

    // Filtrer les IDs valides
    const validParticipantIds = participantIds.filter(id => 
      id && typeof id === 'string' && id.length === 24
    );

    if (validParticipantIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid participant IDs provided'
      });
    }

    // Inclure l'utilisateur courant dans les participants
    const allUserIds = [...new Set([req.user.id, ...validParticipantIds])];
    const allParticipants = allUserIds.map(userId => ({
      userId,
      lastRead: new Date()
    }));

    console.log('🔍 Tous les participants:', allParticipants);

    // Vérifier si une conversation existe déjà
    let conversation = await Conversation.findOne({
      type: 'direct',
      'participants.userId': { $all: allUserIds },
      $expr: { $eq: [{ $size: "$participants" }, allUserIds.length] }
    });

    if (!conversation) {
      // Créer une nouvelle conversation
      conversation = await Conversation.create({
        participants: allParticipants,
        type,
        title: title || `Conversation with ${allUserIds.length} participants`,
        lastMessage: {
          content: 'Conversation started',
          sender: req.user.id,
          timestamp: new Date(),
          type: 'system'
        }
      });
    }

    // Récupérer les infos utilisateurs via API
    const authToken = req.headers.authorization;
    const usersMap = await getMultipleUsersInfo(allUserIds, authToken);

    // Formater la conversation avec les données utilisateur
    const formattedConversation = {
      _id: conversation._id,
      participants: conversation.participants.map(participant => ({
        userId: participant.userId,
        lastRead: participant.lastRead,
        user: usersMap[participant.userId.toString()] || {
          _id: participant.userId,
          name: 'Unknown User',
          avatar: null,
          role: 'candidate'
        }
      })),
      type: conversation.type,
      title: conversation.title,
      lastMessage: {
        content: conversation.lastMessage.content,
        sender: usersMap[conversation.lastMessage.sender.toString()] || {
          _id: conversation.lastMessage.sender,
          name: 'Unknown User',
          avatar: null
        },
        timestamp: conversation.lastMessage.timestamp,
        type: conversation.lastMessage.type
      },
      unreadCount: conversation.unreadCount,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };

    res.status(201).json({
      status: 'success',
      data: {
        conversation: formattedConversation
      }
    });
  } catch (error) {
    console.error('❌ Start conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start conversation: ' + error.message
    });
  }
};

// Marquer une conversation comme lue
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: id,
        'participants.userId': req.user.id
      },
      {
        $set: {
          'participants.$.lastRead': new Date()
        }
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Conversation marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark conversation as read'
    });
  }
};

// Obtenir les statistiques de chat
const getChatStats = async (req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments({
      participants: { $elemMatch: { userId: req.user.id } },
      isActive: true
    });

    const unreadConversations = await Conversation.countDocuments({
      participants: { $elemMatch: { userId: req.user.id } },
      isActive: true,
      unreadCount: { $gt: 0 }
    });

    const totalMessages = await Message.countDocuments({
      sender: req.user.id
    });

    res.json({
      status: 'success',
      data: {
        stats: {
          totalConversations,
          unreadConversations,
          totalMessages
        }
      }
    });
  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get chat stats'
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
  markAsRead,
  getChatStats
};