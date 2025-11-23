// user-service/src/models/UserProfile.js
const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  institution: String,
  degree: String,
  field: String,
  startDate: Date,
  endDate: Date,
  description: String
});

const experienceSchema = new mongoose.Schema({
  company: String,
  position: String,
  location: String,
  startDate: Date,
  endDate: Date,
  current: Boolean,
  description: String,
  skills: [String]
});

const certificationSchema = new mongoose.Schema({
  name: String,
  issuer: String,
  issueDate: Date,
  expiryDate: Date,
  credentialId: String
});

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
    name: {
    type: String,
    required: true,
    default: 'Aviation Professional'
  },
  email: {
    type: String,
    required: true
  },
  avatar: String,
  role: {
    type: String,
    enum: ['candidate', 'recruiter'],
    default: 'candidate'
  },
  headline: {
    type: String,
    default: 'Aviation Professional'
  },
  bio: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  website: String,
  languages: [{
    language: String,
    proficiency: {
      type: String,
      enum: ['basic', 'intermediate', 'fluent', 'native'],
      default: 'basic'
    }
  }],
  skills: [{
    name: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    category: String
  }],
  education: [educationSchema],
  experience: [experienceSchema],
  certifications: [certificationSchema],
  socialLinks: {
    linkedin: String,
    twitter: String,
    github: String
  },
  // Données CV analysées et méta
  cv: {
    originalFileName: { type: String },
    outputFileName: { type: String },
    outputFilePath: { type: String },
    fileId: { type: String },
    analyzedAt: { type: Date },
    parsedData: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  preferences: {
    jobAlerts: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    notifications: {
      message: {
        type: Boolean,
        default: true
      },
      connection: {
        type: Boolean,
        default: true
      },
      job: {
        type: Boolean,
        default: true
      }
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'connections', 'private'],
      default: 'public'
    }
  },
  stats: {
    profileViews: {
      type: Number,
      default: 0
    },
    connectionCount: {
      type: Number,
      default: 0
    },
    jobApplications: {
      type: Number,
      default: 0
    },
    interviewCount: {
      type: Number,
      default: 0
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },
  aviationSpecific: {
    licenseType: [String],
    flightHours: Number,
    aircraftTypes: [String],
    destinations: [String],
    specializations: [String]
  }
}, {
  timestamps: true
});

// Index pour la recherche
userProfileSchema.index({ 
  'skills.name': 'text', 
  headline: 'text', 
  bio: 'text',
  'experience.company': 'text',
  'education.institution': 'text'
});

// Méthode pour mettre à jour lastActive
// user-service/src/models/UserProfile.js - MODIFIER AUSSI
userProfileSchema.methods.updateLastActive = function() {
  this.stats.lastActive = new Date();
  return this.save();
};

// Méthode pour incrémenter les vues de profil
userProfileSchema.methods.incrementProfileViews = function() {
  // ✅ CORRECTION : Vérifier que profileViews est un nombre valide
  if (isNaN(this.stats.profileViews) || this.stats.profileViews === null) {
    this.stats.profileViews = 0;
  }
  this.stats.profileViews += 1;
  return this.save();
};

module.exports = mongoose.model('UserProfile', userProfileSchema);