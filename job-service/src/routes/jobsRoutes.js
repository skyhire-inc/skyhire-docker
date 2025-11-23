// jobs-service/src/routes/jobsRoutes.js - MODIFIER
const express = require('express');
const {
  getAllJobs,
  getMatchingJobsForUser,
  getJobDetails,
  applyToJob,
  getApplicationHistory,
  saveJob,
  getJobsStats,
  getJobCategories,
  // AJOUTER CES IMPORTS
  createJob,
  updateJob,
  deleteJob,
  getApplicationDetails,
  updateApplicationStatus,
  addApplicationCommunication,
  getMyJobs,
  getApplicationsForJob
} = require('../controllers/jobsController');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Routes publiques
router.get('/categories', getJobCategories);
// Définir /my avant /:id pour éviter la capture par la route générique
router.get('/my', protect, authorizeRoles('recruiter','admin'), getMyJobs);
router.get('/', getAllJobs);
router.get('/:id([0-9a-fA-F]{24})', getJobDetails);

// Routes protégées
router.use(protect);

router.get('/user/matching', getMatchingJobsForUser);
router.get('/user/applications', getApplicationHistory);
router.get('/user/applications/:id', getApplicationDetails); // NOUVEAU
router.get('/user/stats', getJobsStats);
router.post('/:id([0-9a-fA-F]{24})/apply', applyToJob);
router.post('/:id([0-9a-fA-F]{24})/save', saveJob);

// Routes pour recruteurs/admins - AJOUTER
router.get('/:id([0-9a-fA-F]{24})/applications', authorizeRoles('recruiter','admin'), getApplicationsForJob);
router.post('/', authorizeRoles('recruiter','admin'), createJob);
router.put('/:id([0-9a-fA-F]{24})', authorizeRoles('recruiter','admin'), updateJob);
router.delete('/:id([0-9a-fA-F]{24})', authorizeRoles('recruiter','admin'), deleteJob);
router.patch('/applications/:id/status', authorizeRoles('recruiter','admin'), updateApplicationStatus);
router.post('/applications/:id/communication', authorizeRoles('recruiter','admin'), addApplicationCommunication);

module.exports = router;