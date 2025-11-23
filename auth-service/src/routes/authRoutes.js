// auth-service/src/routes/authRoutes.js - MODIFIER
const express = require('express');
const { 
  signup, 
  login, 
  getProfile, 
  updateProfile, 
  deleteAccount, 
  changePassword 
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.delete('/account', protect, deleteAccount);
router.put('/change-password', protect, changePassword);

module.exports = router;