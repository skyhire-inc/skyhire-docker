const axios = require('axios');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5002';

const getUserInfo = async (userId, authToken) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/api/users/public/${userId}`, {
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data.status === 'success') {
      const profile = response.data.data.profile;
      return {
        _id: profile.userId,
        name: profile.headline || 'Aviation Professional',
        avatar: '',
        role: 'candidate'
      };
    }
    
    throw new Error('Failed to fetch user info');
  } catch (error) {
    console.error(`❌ Error fetching user ${userId}:`, error.message);
    
    // Fallback
    return {
      _id: userId,
      name: `User ${userId.substring(0, 8)}`,
      avatar: null,
      role: 'candidate'
    };
  }
};

module.exports = { getUserInfo };