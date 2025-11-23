// interview-service/src/data/interviewQuestions.js
const AVIATION_QUESTIONS = {
  behavioral: [
    {
      question: "Describe a time when you had to deal with a difficult passenger. How did you handle the situation?",
      type: "behavioral",
      difficulty: "medium",
      keywords: ["customer service", "conflict resolution", "patience"]
    },
    {
      question: "Tell me about a time you worked effectively in a team under pressure.",
      type: "behavioral", 
      difficulty: "medium",
      keywords: ["teamwork", "pressure", "collaboration"]
    },
    {
      question: "How do you handle emergency situations? Can you give an example from your experience?",
      type: "behavioral",
      difficulty: "hard",
      keywords: ["emergency", "safety", "calmness"]
    },
    {
      question: "Describe a situation where you had to adapt quickly to changing circumstances.",
      type: "behavioral",
      difficulty: "medium", 
      keywords: ["adaptability", "flexibility", "change"]
    },
    {
      question: "How do you ensure excellent customer service while maintaining safety protocols?",
      type: "behavioral",
      difficulty: "medium",
      keywords: ["customer service", "safety", "balance"]
    }
  ],
  
  technical: [
    {
      question: "What are the key safety procedures for emergency landings?",
      type: "technical",
      difficulty: "hard",
      keywords: ["safety procedures", "emergency", "landing"]
    },
    {
      question: "How do you handle medical emergencies onboard?",
      type: "technical",
      difficulty: "medium",
      keywords: ["medical emergency", "first aid", "protocols"]
    },
    {
      question: "What is the importance of CRM (Crew Resource Management) in aviation?",
      type: "technical", 
      difficulty: "medium",
      keywords: ["CRM", "teamwork", "communication"]
    },
    {
      question: "Describe the pre-flight safety checks you would perform.",
      type: "technical",
      difficulty: "easy",
      keywords: ["pre-flight", "safety checks", "preparation"]
    },
    {
      question: "How do you manage fatigue during long-haul flights?",
      type: "technical",
      difficulty: "medium",
      keywords: ["fatigue", "safety", "wellness"]
    }
  ],
  
  situational: [
    {
      question: "If a passenger refuses to fasten their seatbelt during turbulence, what would you do?",
      type: "situational", 
      difficulty: "medium",
      keywords: ["safety", "authority", "communication"]
    },
    {
      question: "How would you handle a situation where two passengers are having a conflict?",
      type: "situational",
      difficulty: "medium",
      keywords: ["conflict resolution", "mediation", "professionalism"]
    },
    {
      question: "What would you do if you noticed a safety issue that other crew members overlooked?",
      type: "situational",
      difficulty: "hard",
      keywords: ["safety", "initiative", "communication"]
    },
    {
      question: "How would you assist a passenger with a fear of flying?",
      type: "situational",
      difficulty: "easy",
      keywords: ["empathy", "reassurance", "customer care"]
    }
  ]
};

const getQuestionsByType = (type, difficulty = 'medium', count = 5) => {
  let questions = [];
  
  if (type === 'mixed') {
    questions = [
      ...AVIATION_QUESTIONS.behavioral.slice(0, 2),
      ...AVIATION_QUESTIONS.technical.slice(0, 2),
      ...AVIATION_QUESTIONS.situational.slice(0, 1)
    ];
  } else {
    questions = AVIATION_QUESTIONS[type] || [];
  }
  
  // Filtrer par difficulté si spécifiée
  if (difficulty !== 'all') {
    questions = questions.filter(q => q.difficulty === difficulty);
  }
  
  // Mélanger et limiter
  return questions
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
};

module.exports = {
  AVIATION_QUESTIONS,
  getQuestionsByType
};