const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const cvController = require('../controllers/cvController');

/**
 * @route   POST /api/cv/analyze
 * @desc    Upload et analyse d'un CV
 * @access  Public
 */
router.post('/analyze', upload.single('cv'), cvController.analyzeCV);

/**
 * @route   GET /api/cv/list
 * @desc    Liste tous les CV analysés
 * @access  Public
 */
router.get('/list', cvController.listAnalyzedCVs);

/**
 * @route   DELETE /api/cv/:filename
 * @desc    Supprime un CV analysé
 * @access  Public
 */
router.delete('/:filename', cvController.deleteAnalyzedCV);

/**
 * @route   GET /api/cv/:filename
 * @desc    Récupère les données d'un CV analysé spécifique
 * @access  Public
 */
router.get('/:filename', cvController.getAnalyzedCV);

module.exports = router;
