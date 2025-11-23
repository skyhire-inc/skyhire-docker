const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const CLIENT_URL_ALT = 'http://localhost:3002'; // Port alternatif pour dev

const targets = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
  USER: process.env.USER_SERVICE_URL || 'http://localhost:5007',
  CV: process.env.CV_SERVICE_URL || 'http://localhost:5003',
  CVPARSER: process.env.CV_PARSER_SERVICE_URL || 'http://localhost:5010',
  INTERVIEW: process.env.INTERVIEW_SERVICE_URL || 'http://localhost:5004',
  INTERVIEW_TOKEN: process.env.INTERVIEW_TOKEN_SERVICE_URL || 'http://localhost:5008',
  JOBS: process.env.JOBS_SERVICE_URL || 'http://localhost:5005',
  CHAT: process.env.CHAT_SERVICE_URL || 'http://localhost:5002',
  NOTIFICATIONS: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:5006',
  AERONAUTICS: process.env.AERONAUTICS_SERVICE_URL || 'http://localhost:8000'
};

app.use(helmet());
app.use(cors({ origin: [CLIENT_URL, CLIENT_URL_ALT], credentials: true }));
app.use(morgan('dev'));

const mkProxy = (target) => createProxyMiddleware({
  target,
  changeOrigin: true,
  ws: true,
  logLevel: 'warn'
});

app.get('/api/health', async (req, res) => {
  const services = [
    { name: 'auth', url: `${targets.AUTH}/api/health` },
    { name: 'users', url: `${targets.USER}/api/health` },
    { name: 'cv', url: `${targets.CV}/api/health` },
    { name: 'cvparser', url: `${targets.CVPARSER}/api/health` },
    { name: 'interview', url: `${targets.INTERVIEW}/api/health` },
    { name: 'interviewToken', url: `${targets.INTERVIEW_TOKEN}/health` },
    { name: 'jobs', url: `${targets.JOBS}/api/health` },
    { name: 'chat', url: `${targets.CHAT}/api/health` },
    { name: 'notifications', url: `${targets.NOTIFICATIONS}/api/health` },
    { name: 'aero', url: `${targets.AERONAUTICS}/health` }
  ];
  const results = await Promise.allSettled(services.map(s => axios.get(s.url).then(r => ({ name: s.name, ok: true, data: r.data })).catch(e => ({ name: s.name, ok: false, error: e.message }))));
  const payload = results.reduce((acc, r, i) => { const name = services[i].name; acc[name] = r.value || { ok: false }; return acc; }, {});
  res.json({ gateway: { ok: true, timestamp: new Date() }, services: payload });
});

app.use('/api/auth', mkProxy(targets.AUTH));
app.use('/api/users', mkProxy(targets.USER));
app.use('/api/cv', mkProxy(targets.CV));
app.use('/api/cv-parser', createProxyMiddleware({
  target: targets.CVPARSER,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/api/cv-parser': '' },
  logLevel: 'warn'
}));
app.use('/api/interview', mkProxy(targets.INTERVIEW));
app.use('/api/interview-token', createProxyMiddleware({
  target: targets.INTERVIEW_TOKEN,
  changeOrigin: true,
  ws: false,
  pathRewrite: { '^/api/interview-token': '' },
  logLevel: 'warn'
}));
app.use('/api/jobs', mkProxy(targets.JOBS));
app.use('/api/chat', mkProxy(targets.CHAT));
app.use('/api/notifications', mkProxy(targets.NOTIFICATIONS));
// Aeronautics chatbot expects bare paths like /chat, not /api/aero/chat
app.use('/api/aero', createProxyMiddleware({
  target: targets.AERONAUTICS,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/api/aero': '' },
  logLevel: 'warn'
}));

app.use('/uploads', mkProxy(targets.CV));

const chatWsProxy = createProxyMiddleware({
  target: targets.CHAT,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/socket.io/chat': '/socket.io' },
  logLevel: 'warn'
});
app.use('/socket.io/chat', chatWsProxy);

const interviewWsProxy = createProxyMiddleware({
  target: targets.INTERVIEW,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/socket.io/interview': '/socket.io' },
  logLevel: 'warn'
});
app.use('/socket.io/interview', interviewWsProxy);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route not found' });
  next();
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Gateway error' });
});

const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  try {
    if (req.url && req.url.startsWith('/socket.io/chat')) {
      return chatWsProxy.upgrade(req, socket, head);
    }
    if (req.url && req.url.startsWith('/socket.io/interview')) {
      return interviewWsProxy.upgrade(req, socket, head);
    }
  } catch (e) {
    try { socket.destroy(); } catch (_) {}
  }
});
server.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
