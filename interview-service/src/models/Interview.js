// interview-service/src/models/Interview.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['behavioral', 'technical', 'situational'],
    default: 'behavioral'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  userAnswer: String,
  audioUrl: String,
  duration: Number,
  answeredAt: Date,
  feedback: {
    score: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    clarity: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    confidence: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    relevance: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    comments: String,
    strengths: [String],
    improvements: [String],
    keywords: [String]
  }
});

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: 'Aviation Interview Simulation'
  },
  type: {
    type: String,
    enum: ['technical', 'behavioral', 'mixed', 'custom'],
    default: 'mixed'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'cancelled'],
    default: 'in-progress'
  },
  questions: [questionSchema],
  overallScore: {
    type: Number,
    min: 0,
    max: 100
  },
  feedback: {
    strengths: [String],
    improvements: [String],
    overallComments: String,
    recommendation: {
      type: String,
      enum: ['excellent', 'good', 'needs_improvement', 'not_ready'],
      default: 'needs_improvement'
    }
  },
  duration: Number,
  sessionData: {
    totalQuestions: Number,
    answeredQuestions: Number,
    averageAnswerTime: Number,
    currentQuestionIndex: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Middleware pour calculer la durée
interviewSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 60000); // en minutes
  }
  
  // Calculer les métriques de session
  if (this.questions && this.questions.length > 0) {
    const answeredQuestions = this.questions.filter(q => q.userAnswer);
    this.sessionData = {
      totalQuestions: this.questions.length,
      answeredQuestions: answeredQuestions.length,
      currentQuestionIndex: answeredQuestions.length,
      averageAnswerTime: answeredQuestions.length > 0 ? 
        answeredQuestions.reduce((sum, q) => sum + (q.duration || 0), 0) / answeredQuestions.length : 0
    };
  }
  
  next();
});

// Méthode pour calculer le score global
interviewSchema.methods.calculateOverallScore = function() {
  const answeredQuestions = this.questions.filter(q => q.userAnswer && q.feedback);
  
  if (answeredQuestions.length === 0) return 0;
  
  const totalScore = answeredQuestions.reduce((sum, q) => sum + (q.feedback.score || 0), 0);
  return Math.round((totalScore / answeredQuestions.length) * 10); // Convertir 0-10 vers 0-100
};

module.exports = mongoose.model('Interview', interviewSchema);