const mongoose = require('mongoose');
const axios = require('axios');
const Connection = require('../models/Connection');
const UserProfile = require('../models/UserProfile');

const NOTIF_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:5007';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const notify = async (req, { userId, title, message, type = 'connection', data = {}, priority = 'medium' }) => {
  try {
    // Respect user preferences (connection notifications)
    if (type === 'connection') {
      const profile = await UserProfile.findOne({ userId }).select('preferences');
      const enabled = profile?.preferences?.notifications?.connection !== false;
      if (!enabled) return; // Skip notification if disabled
    }
    await axios.post(`${NOTIF_URL}/api/notifications`, {
      userId,
      type,
      title,
      message,
      data,
      priority,
    }, {
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  } catch (e) {
    console.error('Failed to send notification:', e?.message);
  }
};

const getPeerProfile = async (peerId) => {
  const profile = await UserProfile.findOne({ userId: peerId }).select('userId name headline location');
  if (!profile) return { _id: peerId, name: `User ${String(peerId).slice(0,8)}`, location: '', headline: '' };
  return {
    _id: profile.userId,
    name: profile.name || profile.headline || 'Aviation Professional',
    headline: profile.headline || '',
    location: profile.location || '',
  };
};

const getConnections = async (req, res) => {
  try {
    const me = req.user.id;
    const docs = await Connection.find({
      status: 'accepted',
      $or: [{ requester: me }, { recipient: me }]
    }).sort({ updatedAt: -1 });

    const items = await Promise.all(docs.map(async (c) => {
      const peerId = String(c.requester) === String(me) ? c.recipient : c.requester;
      const user = await getPeerProfile(peerId);
      return { _id: c._id, peerId, user, status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt };
    }));

    res.json({ status: 'success', data: { connections: items } });
  } catch (e) {
    console.error('getConnections error', e);
    res.status(500).json({ status: 'error', message: 'Failed to get connections' });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const me = req.user.id;
    const docs = await Connection.find({ recipient: me, status: 'pending' }).sort({ createdAt: -1 });

    const items = await Promise.all(docs.map(async (c) => {
      const user = await getPeerProfile(c.requester);
      return { _id: c._id, requester: c.requester, user, status: c.status, createdAt: c.createdAt };
    }));

    res.json({ status: 'success', data: { requests: items } });
  } catch (e) {
    console.error('getPendingRequests error', e);
    res.status(500).json({ status: 'error', message: 'Failed to get pending requests' });
  }
};

const getConnectionStatus = async (req, res) => {
  try {
    const me = req.user.id;
    const { userId } = req.params;
    if (!isValidObjectId(userId) || String(userId) === String(me)) {
      return res.json({ status: 'success', data: { status: 'none' } });
    }

    const doc = await Connection.findOne({
      $or: [
        { requester: me, recipient: userId },
        { requester: userId, recipient: me },
      ]
    });

    if (!doc) return res.json({ status: 'success', data: { status: 'none' } });

    let rel = 'none';
    if (doc.status === 'accepted') rel = 'connected';
    else if (doc.status === 'pending') {
      if (String(doc.requester) === String(me)) rel = 'pending_outgoing';
      else rel = 'pending_incoming';
    }

    res.json({ status: 'success', data: { status: rel, connectionId: doc._id } });
  } catch (e) {
    console.error('getConnectionStatus error', e);
    res.status(500).json({ status: 'error', message: 'Failed to get status' });
  }
};

const sendRequest = async (req, res) => {
  try {
    const me = req.user.id;
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ status: 'error', message: 'Invalid userId' });
    if (String(userId) === String(me)) return res.status(400).json({ status: 'error', message: 'Cannot connect to yourself' });

    // Check existing relation any direction
    const existing = await Connection.findOne({
      $or: [
        { requester: me, recipient: userId },
        { requester: userId, recipient: me },
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.json({ status: 'success', message: 'Already connected', data: { connection: existing } });
      }
      if (existing.status === 'pending') {
        if (String(existing.requester) === String(me)) {
          return res.json({ status: 'success', message: 'Request already sent', data: { connection: existing } });
        }
        // I am recipient of an existing pending -> accept it
        existing.status = 'accepted';
        await existing.save();
        await notify(req, {
          userId: existing.requester,
          title: 'Connection accepted',
          message: 'Your connection request has been accepted.',
          data: { senderId: me }
        });
        return res.json({ status: 'success', message: 'Connection accepted', data: { connection: existing } });
      }
    }

    const conn = await Connection.create({ requester: me, recipient: userId, status: 'pending' });

    await notify(req, {
      userId,
      title: 'New connection request',
      message: 'You have a new connection request.',
      data: { senderId: me }
    });

    res.status(201).json({ status: 'success', data: { connection: conn } });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.json({ status: 'success', message: 'Request already sent' });
    }
    console.error('sendRequest error', e);
    res.status(500).json({ status: 'error', message: 'Failed to send request' });
  }
};

const acceptRequest = async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id' });

    const conn = await Connection.findOne({ _id: id, recipient: me, status: 'pending' });
    if (!conn) return res.status(404).json({ status: 'error', message: 'Request not found' });

    conn.status = 'accepted';
    await conn.save();

    await notify(req, {
      userId: conn.requester,
      title: 'Connection accepted',
      message: 'Your connection request has been accepted.',
      data: { senderId: me }
    });

    res.json({ status: 'success', message: 'Connected', data: { connection: conn } });
  } catch (e) {
    console.error('acceptRequest error', e);
    res.status(500).json({ status: 'error', message: 'Failed to accept request' });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id' });

    const conn = await Connection.findOne({ _id: id, recipient: me, status: 'pending' });
    if (!conn) return res.status(404).json({ status: 'error', message: 'Request not found' });

    conn.status = 'rejected';
    await conn.save();

    res.json({ status: 'success', message: 'Request rejected' });
  } catch (e) {
    console.error('rejectRequest error', e);
    res.status(500).json({ status: 'error', message: 'Failed to reject request' });
  }
};

const removeConnection = async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id' });

    const conn = await Connection.findOne({ _id: id, status: 'accepted', $or: [{ requester: me }, { recipient: me }] });
    if (!conn) return res.status(404).json({ status: 'error', message: 'Connection not found' });

    await Connection.deleteOne({ _id: id });
    res.json({ status: 'success', message: 'Connection removed' });
  } catch (e) {
    console.error('removeConnection error', e);
    res.status(500).json({ status: 'error', message: 'Failed to remove connection' });
  }
};

module.exports = {
  getConnections,
  getPendingRequests,
  getConnectionStatus,
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeConnection,
};
