// jobs-service/src/models/Job.js
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  companyLogo: String,
  location: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship'],
    default: 'full-time'
  },
  category: {
    type: String,
    enum: ['flight-attendant', 'cabin-crew', 'pilot', 'ground-staff', 'management', 'technical'],
    required: true
  },
  salary: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    period: {
      type: String,
      enum: ['monthly', 'yearly', 'hourly'],
      default: 'monthly'
    }
  },
  description: {
    type: String,
    required: true
  },
  requirements: [String],
  responsibilities: [String],
  benefits: [String],
  skills: [String],
  experience: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'executive'],
    default: 'mid'
  },
  education: [String],
  languages: [{
    language: String,
    proficiency: {
      type: String,
      enum: ['basic', 'intermediate', 'fluent', 'native']
    }
  }],
  applicationDeadline: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  isRemote: {
    type: Boolean,
    default: false
  },
  visaSponsorship: {
    type: Boolean,
    default: false
  },
  relocationAssistance: {
    type: Boolean,
    default: false
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    applications: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    }
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  contact: {
    email: String,
    phone: String,
    website: String
  }
}, {
  timestamps: true
});

// Index pour la recherche
jobSchema.index({ 
  title: 'text', 
  description: 'text', 
  company: 'text',
  skills: 'text'
});

jobSchema.index({ category: 1, type: 1, location: 1 });
jobSchema.index({ 'salary.min': 1, 'salary.max': 1 });

// Méthode pour incrémenter les vues
jobSchema.methods.incrementViews = function() {
  this.stats.views += 1;
  return this.save();
};

// Méthode pour incrémenter les sauvegardes
jobSchema.methods.incrementSaves = function() {
  this.stats.saves += 1;
  return this.save();
};

// Méthode pour incrémenter les candidatures
jobSchema.methods.incrementApplications = function() {
  this.stats.applications += 1;
  return this.save();
};

module.exports = mongoose.model('Job', jobSchema);