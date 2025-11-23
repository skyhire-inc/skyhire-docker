const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, no token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérification basique de l'ID utilisateur
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid user ID in token'
      });
    }

    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Not authorized, invalid token'
    });
  }
};

module.exports = { protect };