// cv-service/src/routes/cvRoutes.js
const express = require('express');
const {
  uploadAvatar,
  uploadCV,
  getUserCVs,
  getCVById,
  getCVAnalysis,
  deleteCV,
  getCareerRoadmap
} = require('../controllers/cvController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadAvatarMw = require('../middleware/uploadAvatar');

const router = express.Router();

// Toutes les routes sont protégées
router.use(protect);

// Avatar upload
router.post('/avatar', uploadAvatarMw.single('avatar'), uploadAvatar);

router.post('/upload', upload.single('cv'), uploadCV);
router.get('/', getUserCVs);
router.get('/:id', getCVById);
router.get('/:id/analysis', getCVAnalysis);
router.get('/:id/roadmap', getCareerRoadmap);
router.delete('/:id', deleteCV);

module.exports = router;