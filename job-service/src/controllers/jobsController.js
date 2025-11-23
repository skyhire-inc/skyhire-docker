// jobs-service/src/controllers/jobsController.js
const Job = require('../models/Job');
const Application = require('../models/Application');
const { getMatchingJobs } = require('../services/jobMatching');
const { get } = require('http');
const mongoose = require('mongoose');
const axios = require('axios');

const NOTIF_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:5007';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5002';

const getUserPrefs = async (userId, req) => {
  try {
    const resp = await axios.get(`${USER_SERVICE_URL}/api/users/${userId}`, {
      headers: { Authorization: req.headers.authorization || '', 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    const prefs = resp?.data?.data?.user?.preferences?.notifications || {};
    return {
      job: prefs.job !== false,
    };
  } catch (e) {
    return { job: true };
  }
};

const notifyIfAllowed = async (req, { userId, title, message, data }) => {
  const prefs = await getUserPrefs(userId, req);
  if (!prefs.job) return; // Respect user preference
  try {
    await axios.post(`${NOTIF_URL}/api/notifications`, {
      userId,
      type: 'job',
      title,
      message,
      data: data || {},
      priority: 'medium'
    }, {
      headers: { Authorization: req.headers.authorization || '' },
      timeout: 5000,
    });
  } catch (e) {
    console.error('Failed to create job notification:', e?.message);
  }
};

// Obtenir les jobs postés par l'utilisateur courant (recruteur/admin)
const getMyJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    const safePage = isNaN(p) || p < 1 ? 1 : p;
    const safeLimit = isNaN(l) || l < 1 ? 10 : Math.min(l, 50);
    const skip = (safePage - 1) * safeLimit;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: 'error', message: 'Not authorized' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id' });
    }

    const filter = { postedBy: req.user.id, isActive: true };

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit);

    const total = await Job.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        jobs,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          pages: Math.ceil(total / safeLimit)
        }
      }
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get my jobs'
    });
  }
};

// Obtenir tous les jobs avec filtres
const getAllJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      type,
      location,
      minSalary,
      experience,
      remote,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    let filter = { isActive: true };

    // Filtres de recherche
    if (search) {
      filter.$text = { $search: search };
    }
    if (category) {
      filter.category = category;
    }
    if (type) {
      filter.type = type;
    }
    if (location) {
      filter.location = new RegExp(location, 'i');
    }
    if (minSalary) {
      filter['salary.max'] = { $gte: parseInt(minSalary) };
    }
    if (experience) {
      filter.experience = experience;
    }
    if (remote !== undefined) {
      filter.isRemote = remote === 'true';
    }

    // Tri
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const jobs = await Job.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-description -requirements -responsibilities -benefits');

    const total = await Job.countDocuments(filter);

    // Incrémenter les vues pour les jobs récupérés
    jobs.forEach(job => job.incrementViews());

    res.json({
      status: 'success',
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get jobs'
    });
  }
};

// Obtenir les jobs matching avec le profil utilisateur
const getMatchingJobsForUser = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      type,
      location,
      minSalary,
      experience,
      remote
    } = req.query;

    const skip = (page - 1) * limit;
    let filter = { isActive: true };

    // Appliquer les filtres
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (location) filter.location = new RegExp(location, 'i');
    if (minSalary) filter['salary.max'] = { $gte: parseInt(minSalary) };
    if (experience) filter.experience = experience;
    if (remote !== undefined) filter.isRemote = remote === 'true';

    const jobs = await Job.find(filter)
      .skip(skip)
      .limit(parseInt(limit));

    // Simulation du profil utilisateur et compétences
    // En production, récupérer depuis user-service
    const userProfile = {
      experience: 'mid',
      education: ['Bachelor Degree'],
      languages: [
        { language: 'English', proficiency: 'fluent' },
        { language: 'French', proficiency: 'intermediate' }
      ],
      salaryExpectations: 4000
    };

    const userSkills = [
      'Customer Service',
      'Safety Procedures',
      'Communication',
      'Teamwork',
      'Problem Solving'
    ];

    const filters = {
      category, type, location, minSalary, experience, remote
    };

    const matchingJobs = await getMatchingJobs(jobs, userProfile, userSkills, filters);

    // Incrémenter les vues
    matchingJobs.forEach(jobData => {
      Job.findByIdAndUpdate(jobData.job._id, { $inc: { 'stats.views': 1 } });
    });

    res.json({
      status: 'success',
      data: {
        jobs: matchingJobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: matchingJobs.length,
          pages: Math.ceil(matchingJobs.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get matching jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get matching jobs'
    });
  }
};

// Obtenir les détails d'un job
const getJobDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    // Incrémenter les vues
    await job.incrementViews();

    let existingApplication = null;
    if (req.user && req.user.id) {
      existingApplication = await Application.findOne({
        jobId: id,
        userId: req.user.id
      });
    }

    res.json({
      status: 'success',
      data: {
        job,
        hasApplied: !!existingApplication,
        applicationId: existingApplication?._id
      }
    });
  } catch (error) {
    console.error('Get job details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get job details'
    });
  }
};

// Postuler à un job
const applyToJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { coverLetter, answers, cvId } = req.body;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    // Vérifier si l'utilisateur a déjà postulé
    const existingApplication = await Application.findOne({
      jobId: id,
      userId: req.user.id
    });

    if (existingApplication) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already applied to this job'
      });
    }

    // Simulation du matching score
    const userProfile = {
      experience: 'mid',
      education: ['Bachelor Degree'],
      salaryExpectations: 4000
    };

    const userSkills = ['Customer Service', 'Safety Procedures', 'Communication'];
    const matchScore = 85; // En production, calculer avec le service de matching

    // Créer la candidature
    const application = await Application.create({
      userId: req.user.id,
      jobId: id,
      cvId,
      coverLetter,
      answers,
      matchScore,
      matchDetails: {
        skillsMatch: 80,
        experienceMatch: 90,
        educationMatch: 85,
        locationMatch: 75,
        salaryMatch: 80
      }
    });

    // Incrémenter le compteur de candidatures du job
    await job.incrementApplications();

    // Notify recruiter about new application (respect preferences)
    try {
      if (job.postedBy) {
        await notifyIfAllowed(req, {
          userId: job.postedBy,
          title: 'New application',
          message: `A new application was submitted for ${job.title}`,
          data: { jobId: job._id, applicantId: req.user.id, applicationId: application._id }
        });
      }
    } catch (_) {}

    res.status(201).json({
      status: 'success',
      message: 'Application submitted successfully',
      data: {
        application
      }
    });
  } catch (error) {
    console.error('Apply to job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to apply to job'
    });
  }
};

// Obtenir l'historique des candidatures
const getApplicationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let filter = { userId: req.user.id };
    if (status) {
      filter.status = status;
    }

    const applications = await Application.find(filter)
      .populate('jobId', 'title company location type salary')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get application history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get application history'
    });
  }
};

// Obtenir toutes les candidatures pour un job (recruteur/admin)
const getApplicationsForJob = async (req, res) => {
  try {
    const { id } = req.params;
    // Vérifier que le job appartient à l'utilisateur courant
    const job = await Job.findOne({ _id: id, postedBy: req.user.id });
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or not authorized'
      });
    }

    const applications = await Application.find({ jobId: id })
      .sort({ appliedAt: -1 });

    res.json({
      status: 'success',
      data: { applications }
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get job applications'
    });
  }
};

// Sauvegarder un job
const saveJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    // En production, créer un modèle SavedJob
    // Pour l'instant, on incrémente juste le compteur
    await job.incrementSaves();

    res.json({
      status: 'success',
      message: 'Job saved successfully'
    });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save job'
    });
  }
};

// Obtenir les statistiques des jobs
const getJobsStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments({ isActive: true });
    const totalApplications = await Application.countDocuments({ userId: req.user.id });
    const pendingApplications = await Application.countDocuments({ 
      userId: req.user.id, 
      status: 'pending' 
    });
    
    const applicationsByStatus = await Application.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const avgMatchScore = await Application.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: null, avgScore: { $avg: '$matchScore' } } }
    ]);

    res.json({
      status: 'success',
      data: {
        stats: {
          totalJobs,
          totalApplications,
          pendingApplications,
          applicationsByStatus: applicationsByStatus.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          avgMatchScore: avgMatchScore[0]?.avgScore || 0
        }
      }
    });
  } catch (error) {
    console.error('Get jobs stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get jobs stats'
    });
  }
};

// Obtenir les catégories de jobs disponibles
const getJobCategories = async (req, res) => {
  try {
    const categories = await Job.distinct('category', { isActive: true });
    
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await Job.countDocuments({ 
          category, 
          isActive: true 
        });
        return {
          name: category,
          count,
          label: category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')
        };
      })
    );

    res.json({
      status: 'success',
      data: {
        categories: categoriesWithCounts
      }
    });
  } catch (error) {
    console.error('Get job categories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get job categories'
    });
  }
};
// Créer un nouveau job (pour recruteurs/admins)
const createJob = async (req, res) => {
  try {
    const {
      title,
      company,
      companyLogo,
      location,
      type,
      category,
      salary,
      description,
      requirements,
      responsibilities,
      benefits,
      skills,
      experience,
      education,
      languages,
      applicationDeadline,
      isRemote,
      visaSponsorship,
      relocationAssistance,
      contact
    } = req.body;

    // Validation des champs requis
    if (!title || !company || !location || !category || !description || !salary) {
      return res.status(400).json({
        status: 'error',
        message: 'Title, company, location, category, description and salary are required'
      });
    }

    const job = await Job.create({
      title,
      company,
      companyLogo,
      location,
      type: type || 'full-time',
      category,
      salary: {
        min: salary.min,
        max: salary.max,
        currency: salary.currency || 'USD',
        period: salary.period || 'monthly'
      },
      description,
      requirements: requirements || [],
      responsibilities: responsibilities || [],
      benefits: benefits || [],
      skills: skills || [],
      experience: experience || 'mid',
      education: education || [],
      languages: languages || [],
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
      isRemote: isRemote || false,
      visaSponsorship: visaSponsorship || false,
      relocationAssistance: relocationAssistance || false,
      contact: contact || {},
      postedBy: req.user.id
    });

    res.status(201).json({
      status: 'success',
      message: 'Job created successfully',
      data: {
        job
      }
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create job: ' + error.message
    });
  }
};

// Mettre à jour un job
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const job = await Job.findOneAndUpdate(
      { _id: id, postedBy: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or you are not authorized to update it'
      });
    }

    res.json({
      status: 'success',
      message: 'Job updated successfully',
      data: {
        job
      }
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update job'
    });
  }
};

// Supprimer un job (soft delete)
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findOneAndUpdate(
      { _id: id, postedBy: req.user.id },
      { isActive: false },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or you are not authorized to delete it'
      });
    }

    res.json({
      status: 'success',
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete job'
    });
  }
};

// Obtenir les détails d'une application
const getApplicationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findOne({
      _id: id,
      userId: req.user.id
    }).populate('jobId', 'title company location type salary');

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        application
      }
    });
  } catch (error) {
    console.error('Get application details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get application details'
    });
  }
};

// Mettre à jour le statut d'une application (pour recruteurs)
const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const application = await Application.findOneAndUpdate(
      { _id: id },
      { 
        status,
        notes,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('jobId', 'title company');

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }

    // Notify candidate about status update (respect preferences)
    try {
      await notifyIfAllowed(req, {
        userId: application.userId,
        title: 'Application status updated',
        message: `Your application for ${application.jobId?.title || 'a job'} is now '${status}'`,
        data: { applicationId: application._id, jobId: application.jobId?._id }
      });
    } catch (_) {}

    res.json({
      status: 'success',
      message: 'Application status updated successfully',
      data: {
        application
      }
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update application status'
    });
  }
};

// Ajouter une communication à une application
const addApplicationCommunication = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, subject, content, from, to } = req.body;

    const application = await Application.findOneAndUpdate(
      { _id: id },
      {
        $push: {
          communication: {
            type,
            subject,
            content,
            from,
            to,
            date: new Date()
          }
        }
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Communication added successfully',
      data: {
        application
      }
    });
  } catch (error) {
    console.error('Add application communication error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add communication'
    });
  }
};

module.exports = {
  getMyJobs,
  createJob,
  updateJob,
  deleteJob,
  addApplicationCommunication, 
  getApplicationDetails, 
  updateApplicationStatus,
  getAllJobs,
  getMatchingJobsForUser,
  getJobDetails,
  applyToJob,
  getApplicationHistory,
  getApplicationsForJob,
  saveJob,
  getJobsStats,
  getJobCategories
};