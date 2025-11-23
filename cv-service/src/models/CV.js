// cv-service/src/models/CV.js
const mongoose = require('mongoose');

const analysisResultSchema = new mongoose.Schema({
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  skills: [String],
  strengths: [String],
  improvements: [String],
  recommendations: [String],
  extractedText: String,
  analysisDate: {
    type: Date,
    default: Date.now
  },
  aviationMatch: {
    score: Number,
    matchedRequirements: [String],
    missingRequirements: [String],
    suggestions: [String]
  }
});

const cvSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  analysisResult: analysisResultSchema,
  isActive: {
    type: Boolean,
    default: true
  },
  isAnalyzed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index pour performances
cvSchema.index({ userId: 1, uploadDate: -1 });
cvSchema.index({ 'analysisResult.score': -1 });

module.exports = mongoose.model('CV', cvSchema);