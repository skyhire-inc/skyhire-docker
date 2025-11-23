const axios = require('axios');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5002';

const getUserInfo = async (userId, authToken) => {
  try {
    console.log(`🔍 [CHAT-SERVICE] Fetching user ${userId}`);
    
    // 🔥 UTILISE LA ROUTE PUBLIQUE qui existe déjà
    const response = await axios.get(`${USER_SERVICE_URL}/api/users/public/${userId}`, {
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`✅ [CHAT-SERVICE] User API response status:`, response.status);
    
    if (response.data.status === 'success') {
      // 🔥 ADAPTE les données au format attendu par le chat
      const profile = response.data.data.profile;
      return {
        _id: profile.userId, // Utilise userId du profil
        name: profile.name || profile.headline || 'Aviation Professional',
        avatar: '',
        role: 'candidate',
        email: ''
      };
    }
    
    throw new Error('API returned error status');
  } catch (error) {
    console.error(`❌ [CHAT-SERVICE] Error fetching user ${userId}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Fallback amélioré
    return {
      _id: userId,
      name: `User ${userId.substring(0, 8)}`,
      avatar: null,
      role: 'candidate',
      email: `user${userId.substring(0, 8)}@example.com`
    };
  }
};

const getMultipleUsersInfo = async (userIds, authToken) => {
  try {
    console.log(`🔍 [CHAT-SERVICE] Fetching ${userIds.length} users:`, userIds);
    
    const uniqueIds = [...new Set(userIds)];
    const usersPromises = uniqueIds.map(id => getUserInfo(id, authToken));
    const users = await Promise.all(usersPromises);
    
    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id] = user;
    });
    
    console.log(`✅ [CHAT-SERVICE] Users map created with ${Object.keys(usersMap).length} users`);
    return usersMap;
  } catch (error) {
    console.error('❌ [CHAT-SERVICE] Error fetching multiple users:', error);
    return {};
  }
};

module.exports = {
  getUserInfo,
  getMultipleUsersInfo,
  async getUserPrefs(userId, authToken) {
    try {
      const resp = await axios.get(`${USER_SERVICE_URL}/api/users/${userId}`, {
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
        timeout: 5000,
      });
      const user = resp?.data?.data?.user || {};
      const prefs = user?.preferences?.notifications || {};
      return {
        message: prefs.message !== false,
        connection: prefs.connection !== false,
        job: prefs.job !== false,
      };
    } catch (e) {
      return { message: true, connection: true, job: true };
    }
  }
};