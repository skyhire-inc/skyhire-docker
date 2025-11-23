// interview-service/src/controllers/interviewController.js
const Interview = require('../models/Interview');
const { getQuestionsByType } = require('../data/interviewQuestions');
const { analyzeAnswer, generateOverallFeedback } = require('../services/interviewAnalysis');

// Démarrer une nouvelle interview
const startInterview = async (req, res) => {
  try {
    const { type = 'mixed', difficulty = 'medium', questionCount = 5 } = req.body;

    // Sélectionner les questions
    const selectedQuestions = getQuestionsByType(type, difficulty, questionCount);
    
    if (selectedQuestions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No questions available for the selected criteria'
      });
    }

    const interview = await Interview.create({
      userId: req.user.id,
      type,
      difficulty,
      questions: selectedQuestions,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Aviation Interview`,
      sessionData: {
        totalQuestions: selectedQuestions.length,
        answeredQuestions: 0,
        currentQuestionIndex: 0
      }
    });

    res.status(201).json({
      status: 'success',
      data: {
        interview: {
          id: interview._id,
          title: interview.title,
          type: interview.type,
          difficulty: interview.difficulty,
          questions: interview.questions,
          sessionData: interview.sessionData,
          startTime: interview.startTime
        }
      }
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start interview'
    });
  }
};

// Soumettre une réponse
const submitAnswer = async (req, res) => {
  try {
    const { questionIndex, answer, audioUrl, duration } = req.body;
    const { id } = req.params;

    const interview = await Interview.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!interview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }

    if (questionIndex >= interview.questions.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid question index'
      });
    }

    const question = interview.questions[questionIndex];
    
    // Analyser la réponse
    const feedback = await analyzeAnswer(question, answer, duration);

    // Mettre à jour la question
    interview.questions[questionIndex].userAnswer = answer;
    interview.questions[questionIndex].audioUrl = audioUrl;
    interview.questions[questionIndex].duration = duration;
    interview.questions[questionIndex].feedback = feedback;
    interview.questions[questionIndex].answeredAt = new Date();

    await interview.save();

    // Vérifier si c'est la dernière question
    const nextQuestionIndex = questionIndex + 1;
    const isLastQuestion = nextQuestionIndex >= interview.questions.length;

    res.json({
      status: 'success',
      data: {
        feedback,
        nextQuestion: isLastQuestion ? null : nextQuestionIndex,
        isComplete: isLastQuestion
      }
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit answer'
    });
  }
};

// Terminer l'interview
const endInterview = async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await Interview.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!interview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }

    interview.status = 'completed';
    interview.endTime = new Date();
    interview.overallScore = interview.calculateOverallScore();
    interview.feedback = generateOverallFeedback(interview);

    await interview.save();

    res.json({
      status: 'success',
      data: {
        interview: {
          id: interview._id,
          overallScore: interview.overallScore,
          feedback: interview.feedback,
          duration: interview.duration,
          endTime: interview.endTime
        }
      }
    });
  } catch (error) {
    console.error('End interview error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to end interview'
    });
  }
};

// Obtenir l'historique des interviews
const getInterviewHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const interviews = await Interview.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title type difficulty status overallScore duration startTime endTime');

    const total = await Interview.countDocuments({ userId: req.user.id });

    res.json({
      status: 'success',
      data: {
        interviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get interview history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get interview history'
    });
  }
};

// Obtenir les détails d'une interview
const getInterviewDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await Interview.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!interview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        interview
      }
    });
  } catch (error) {
    console.error('Get interview details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get interview details'
    });
  }
};

// Obtenir les statistiques d'interview
const getInterviewStats = async (req, res) => {
  try {
    const totalInterviews = await Interview.countDocuments({ userId: req.user.id });
    const completedInterviews = await Interview.countDocuments({ 
      userId: req.user.id, 
      status: 'completed' 
    });
    
    const interviews = await Interview.find({ 
      userId: req.user.id,
      status: 'completed'
    }).select('overallScore type difficulty');
    
    const avgScore = interviews.length > 0 
      ? interviews.reduce((sum, i) => sum + (i.overallScore || 0), 0) / interviews.length 
      : 0;
    
    const typeDistribution = {};
    const difficultyDistribution = {};
    
    interviews.forEach(i => {
      typeDistribution[i.type] = (typeDistribution[i.type] || 0) + 1;
      difficultyDistribution[i.difficulty] = (difficultyDistribution[i.difficulty] || 0) + 1;
    });

    res.json({
      status: 'success',
      data: {
        stats: {
          totalInterviews,
          completedInterviews,
          avgScore: Math.round(avgScore * 10) / 10,
          typeDistribution,
          difficultyDistribution,
          totalPracticeTime: interviews.reduce((sum, i) => sum + (i.duration || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Get interview stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get interview stats'
    });
  }
};

module.exports = {
  startInterview,
  submitAnswer,
  endInterview,
  getInterviewHistory,
  getInterviewDetails,
  getInterviewStats
};