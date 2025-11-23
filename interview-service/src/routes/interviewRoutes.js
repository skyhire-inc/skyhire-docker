// interview-service/src/routes/interviewRoutes.js
const express = require('express');
const {
  startInterview,
  submitAnswer,
  endInterview,
  getInterviewHistory,
  getInterviewDetails,
  getInterviewStats
} = require('../controllers/interviewController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes sont protégées
router.use(protect);

router.post('/start', startInterview);
router.post('/:id/answer', submitAnswer);
router.post('/:id/end', endInterview);
router.get('/history', getInterviewHistory);
router.get('/stats', getInterviewStats);
router.get('/:id', getInterviewDetails);

module.exports = router;