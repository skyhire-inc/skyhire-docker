// user-service/src/routes/userRoutes.js
const express = require('express');
const {
  getProfile,
  updateProfile,
  searchUsers,
  getUserStats,
  getPublicProfile,
  addSkill,
  removeSkill,
  autoCreateProfile,
  getUserById,
  saveParsedCV
} = require('../controllers/userController');
const {
  getConnections,
  getPendingRequests,
  getConnectionStatus,
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeConnection,
} = require('../controllers/connectionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Routes publiques (placer avant les routes dynamiques)
router.get('/search', searchUsers);
router.get('/public/:userId([0-9a-fA-F]{24})', getPublicProfile);
router.post('/profile/auto-create', autoCreateProfile);

// Routes protégées
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/profile/cv', protect, saveParsedCV);
router.get('/stats', protect, getUserStats);
router.post('/skills', protect, addSkill);
router.delete('/skills/:skillId', protect, removeSkill);

// Crew Network: connections
router.get('/connections', protect, getConnections);
router.get('/connections/requests', protect, getPendingRequests);
router.get('/connections/status/:userId([0-9a-fA-F]{24})', protect, getConnectionStatus);
router.post('/connections/request/:userId([0-9a-fA-F]{24})', protect, sendRequest);
router.post('/connections/accept/:id([0-9a-fA-F]{24})', protect, acceptRequest);
router.post('/connections/reject/:id([0-9a-fA-F]{24})', protect, rejectRequest);
router.delete('/connections/:id([0-9a-fA-F]{24})', protect, removeConnection);

// Cette route doit être APRÈS '/search' sinon elle capture '/search'
router.get('/:userId([0-9a-fA-F]{24})', protect, getUserById);

module.exports = router;