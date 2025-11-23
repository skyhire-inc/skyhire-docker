// user-service/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const UserProfile = require('../models/UserProfile');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// user-service/src/middleware/auth.js - MODIFIER protect
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    console.log('🔐 Auth middleware - Token present:', !!token);

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, no token provided'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token decoded successfully:', { userId: decoded.userId });
      
      // ✅ Charger le profil s'il existe (mais NE PAS le créer ici)
      let userProfile = null;
      try {
        userProfile = await UserProfile.findOne({ userId: decoded.userId });
        if (userProfile) {
          console.log('✅ Profile found:', userProfile._id);
        } else {
          console.log('ℹ️ No profile yet for user:', decoded.userId);
        }
      } catch (dbError) {
        console.error('⚠️ Database error (non-fatal):', dbError.message);
      }

      req.user = {
        id: decoded.userId,
        role: decoded.role,
        profile: userProfile
      };
      next();
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, invalid token',
        error: jwtError.message
      });
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    res.status(401).json({
      status: 'error',
      message: 'Not authorized, authentication failed',
      error: error.message
    });
  }
};

module.exports = { protect };