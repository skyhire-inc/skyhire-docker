// interview-service/src/services/interviewAnalysis.js - VERSION CORRIGÉE COMPLÈTE
// Service simulé d'analyse AI des réponses d'entretien

const analyzeAnswer = async (question, userAnswer, duration) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulation d'analyse AI - à remplacer par l'AI réelle
      const baseScore = Math.floor(Math.random() * 3) + 7; // 7-9 de base
      
      // Facteurs d'ajustement basés sur la réponse
      const answerLength = userAnswer.length;
      const hasKeywords = checkKeywords(question.keywords, userAnswer);
      const structureScore = evaluateStructure(userAnswer);
      
      // Score final calculé
      const finalScore = Math.min(10, baseScore + 
        (answerLength > 100 ? 0.5 : 0) +
        (hasKeywords ? 0.5 : 0) +
        structureScore
      );

      const feedback = generateFeedback(question, userAnswer, finalScore, duration);
      
      resolve(feedback);
    }, 2000); // Simule 2 secondes d'analyse
  });
};

const checkKeywords = (keywords, answer) => {
  if (!keywords || !answer) return false;
  const answerLower = answer.toLowerCase();
  return keywords.some(keyword => answerLower.includes(keyword.toLowerCase()));
};

const evaluateStructure = (answer) => {
  if (!answer) return 0;
  
  let score = 0;
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length >= 3) score += 0.5; // Bonne structure
  if (answer.length > 150) score += 0.5; // Réponse détaillée
  
  return score;
};

const generateFeedback = (question, answer, finalScore, duration) => {
  const strengths = [];
  const improvements = [];
  const comments = [];
  
  // Évaluer la clarté
  const clarity = Math.min(10, finalScore + (answer.length > 80 ? 1 : 0));
  
  // Évaluer la confiance
  const confidence = Math.min(10, finalScore + (duration < 60 ? 1 : 0));
  
  // Évaluer la pertinence
  const relevance = Math.min(10, finalScore + (checkKeywords(question.keywords, answer) ? 1 : 0));
  
  // Générer les commentaires basés sur le score
  if (finalScore >= 8) {
    strengths.push("Excellent response structure");
    strengths.push("Good use of relevant terminology");
    comments.push("Well-articulated answer demonstrating strong understanding.");
  } else if (finalScore >= 6) {
    strengths.push("Clear communication");
    strengths.push("Relevant experience shared");
    improvements.push("Consider providing more specific examples");
    comments.push("Solid response. Adding more details would strengthen your answer.");
  } else {
    improvements.push("Work on structuring your responses");
    improvements.push("Include more specific examples from experience");
    improvements.push("Practice using aviation-specific terminology");
    comments.push("Good effort. Focus on providing more structured and detailed responses.");
  }
  
  // Commentaires spécifiques au type de question
  if (question.type === 'behavioral') {
    comments.push("Remember to use the STAR method (Situation, Task, Action, Result) for behavioral questions.");
  } else if (question.type === 'technical') {
    comments.push("Good technical knowledge. Consider relating answers to real-world aviation scenarios.");
  }
  
  // Suggestions basées sur la durée
  if (duration < 30) {
    improvements.push("Take more time to structure your thoughts before answering");
  } else if (duration > 120) {
    improvements.push("Practice being more concise in your responses");
  }
  
  return {
    score: Math.round(finalScore * 10) / 10,
    clarity: Math.round(clarity * 10) / 10,
    confidence: Math.round(confidence * 10) / 10,
    relevance: Math.round(relevance * 10) / 10,
    comments: comments.join(' '),
    strengths,
    improvements,
    keywords: question.keywords || []
  };
};

const generateOverallFeedback = (interview) => {
  const answeredQuestions = interview.questions.filter(q => q.userAnswer && q.feedback);
  
  if (answeredQuestions.length === 0) {
    return {
      strengths: [],
      improvements: ["Complete more questions to receive detailed feedback"],
      overallComments: "Start answering questions to get personalized feedback.",
      recommendation: "not_ready"
    };
  }
  
  const avgScore = answeredQuestions.reduce((sum, q) => sum + q.feedback.score, 0) / answeredQuestions.length;
  const strengths = new Set();
  const improvements = new Set();
  
  answeredQuestions.forEach(q => {
    q.feedback.strengths.forEach(s => strengths.add(s));
    q.feedback.improvements.forEach(i => improvements.add(i));
  });
  
  let recommendation;
  if (avgScore >= 8) recommendation = "excellent";
  else if (avgScore >= 6) recommendation = "good";
  else if (avgScore >= 4) recommendation = "needs_improvement";
  else recommendation = "not_ready";
  
  let overallComments;
  if (avgScore >= 8) {
    overallComments = "Outstanding performance! You demonstrate excellent preparation and communication skills.";
  } else if (avgScore >= 6) {
    overallComments = "Good overall performance. With some refinement, you'll be well-prepared for real interviews.";
  } else {
    overallComments = "Continue practicing to improve your interview skills. Focus on structure and specific examples.";
  }
  
  return {
    strengths: Array.from(strengths).slice(0, 3),
    improvements: Array.from(improvements).slice(0, 3),
    overallComments,
    recommendation
  };
};

module.exports = {
  analyzeAnswer,
  generateOverallFeedback
};