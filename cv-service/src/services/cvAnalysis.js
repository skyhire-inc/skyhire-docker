// cv-service/src/services/cvAnalysis.js
// Service simulé - plus tard on intégrera l'AI réelle

const analyzeCV = async (filePath, userId) => {
  // Simulation d'analyse - à remplacer par l'AI réelle
  return new Promise((resolve) => {
    setTimeout(() => {
      const skills = ['Customer Service', 'Safety Procedures', 'Teamwork', 'Communication', 'Problem Solving'];
      const strengths = ['Strong work experience in relevant field', 'Clear career objectives', 'Good educational background'];
      const improvements = ['Add more specific technical skills', 'Include language certifications', 'Highlight leadership experiences'];
      const recommendations = ['Consider obtaining additional safety certifications', 'Practice interview scenarios', 'Network with aviation professionals'];
      
      const analysisResult = {
        score: Math.floor(Math.random() * 30) + 70, // Score entre 70-100
        skills: skills.slice(0, Math.floor(Math.random() * 3) + 2), // 2-4 skills aléatoires
        strengths: strengths.slice(0, 2),
        improvements: improvements,
        recommendations: recommendations.slice(0, 2),
        extractedText: 'Sample extracted text from CV analysis... This would contain the actual text from the uploaded CV file.',
        aviationMatch: {
          score: Math.floor(Math.random() * 25) + 75,
          matchedRequirements: ['Customer Service Experience', 'Safety Awareness', 'Communication Skills'],
          missingRequirements: ['Specific Aviation Certifications', 'Flight Hours'],
          suggestions: ['Obtain basic aviation safety certification', 'Gain customer service experience in related fields']
        }
      };
      
      resolve(analysisResult);
    }, 3000); // Simule 3 secondes d'analyse
  });
};

module.exports = { analyzeCV };