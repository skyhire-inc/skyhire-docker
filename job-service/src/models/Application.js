// jobs-service/src/models/Application.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  cvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CV'
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending'
  },
  coverLetter: String,
  answers: [{
    question: String,
    answer: String
  }],
  matchScore: {
    type: Number,
    min: 0,
    max: 100
  },
  matchDetails: {
    skillsMatch: Number,
    experienceMatch: Number,
    educationMatch: Number,
    locationMatch: Number,
    salaryMatch: Number
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date,
  notes: String,
  communication: [{
    type: {
      type: String,
      enum: ['email', 'message', 'call', 'interview']
    },
    subject: String,
    content: String,
    date: {
      type: Date,
      default: Date.now
    },
    from: String,
    to: String
  }]
}, {
  timestamps: true
});

// Index pour performances
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ jobId: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);