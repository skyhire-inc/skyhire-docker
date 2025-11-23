// jobs-service/src/services/jobMatching.js
// Service de matching entre jobs et profils utilisateurs

const calculateJobMatch = async (job, userProfile, userSkills = []) => {
  // Simulation de matching AI - à améliorer avec l'AI réelle
  let totalScore = 0;
  const matchDetails = {};
  
  // Matching des compétences (40%)
  const skillsMatch = calculateSkillsMatch(job.skills, userSkills);
  matchDetails.skillsMatch = skillsMatch;
  totalScore += skillsMatch * 0.4;
  
  // Matching de l'expérience (25%)
  const experienceMatch = calculateExperienceMatch(job.experience, userProfile?.experience);
  matchDetails.experienceMatch = experienceMatch;
  totalScore += experienceMatch * 0.25;
  
  // Matching de l'éducation (15%)
  const educationMatch = calculateEducationMatch(job.education, userProfile?.education);
  matchDetails.educationMatch = educationMatch;
  totalScore += educationMatch * 0.15;
  
  // Matching des langues (10%)
  const languageMatch = calculateLanguageMatch(job.languages, userProfile?.languages);
  matchDetails.languageMatch = languageMatch;
  totalScore += languageMatch * 0.1;
  
  // Matching du salaire (10%)
  const salaryMatch = calculateSalaryMatch(job.salary, userProfile?.salaryExpectations);
  matchDetails.salaryMatch = salaryMatch;
  totalScore += salaryMatch * 0.1;
  
  const finalScore = Math.round(totalScore * 100);
  
  return {
    score: finalScore,
    details: matchDetails,
    recommendations: generateRecommendations(job, matchDetails)
  };
};

const calculateSkillsMatch = (jobSkills, userSkills) => {
  if (!jobSkills || jobSkills.length === 0) return 1;
  if (!userSkills || userSkills.length === 0) return 0;
  
  const userSkillNames = userSkills.map(skill => skill.name?.toLowerCase() || skill.toLowerCase());
  const jobSkillNames = jobSkills.map(skill => skill.toLowerCase());
  
  const matchedSkills = jobSkillNames.filter(skill => 
    userSkillNames.some(userSkill => userSkill.includes(skill) || skill.includes(userSkill))
  );
  
  return matchedSkills.length / jobSkillNames.length;
};

const calculateExperienceMatch = (jobExperience, userExperience) => {
  const experienceLevels = {
    'entry': 1,
    'mid': 2,
    'senior': 3,
    'executive': 4
  };
  
  const jobLevel = experienceLevels[jobExperience] || 2;
  const userLevel = userExperience ? 3 : 2; // Simulation
  
  return Math.max(0, 1 - Math.abs(jobLevel - userLevel) / 4);
};

const calculateEducationMatch = (jobEducation, userEducation) => {
  if (!jobEducation || jobEducation.length === 0) return 1;
  if (!userEducation || userEducation.length === 0) return 0;
  
  // Simulation basique - à améliorer
  return 0.7;
};

const calculateLanguageMatch = (jobLanguages, userLanguages) => {
  if (!jobLanguages || jobLanguages.length === 0) return 1;
  if (!userLanguages || userLanguages.length === 0) return 0;
  
  const userLangMap = {};
  userLanguages.forEach(lang => {
    userLangMap[lang.language?.toLowerCase()] = lang.proficiency;
  });
  
  let matchedCount = 0;
  jobLanguages.forEach(jobLang => {
    const userProficiency = userLangMap[jobLang.language?.toLowerCase()];
    if (userProficiency) {
      const proficiencyLevels = {
        'basic': 1,
        'intermediate': 2,
        'fluent': 3,
        'native': 4
      };
      
      const jobLevel = proficiencyLevels[jobLang.proficiency] || 2;
      const userLevel = proficiencyLevels[userProficiency] || 1;
      
      if (userLevel >= jobLevel) {
        matchedCount++;
      }
    }
  });
  
  return matchedCount / jobLanguages.length;
};

const calculateSalaryMatch = (jobSalary, userSalaryExpectations) => {
  if (!jobSalary || !userSalaryExpectations) return 0.5;
  
  const jobAvg = (jobSalary.min + jobSalary.max) / 2;
  const userAvg = userSalaryExpectations;
  
  const difference = Math.abs(jobAvg - userAvg) / jobAvg;
  return Math.max(0, 1 - difference);
};

const generateRecommendations = (job, matchDetails) => {
  const recommendations = [];
  
  if (matchDetails.skillsMatch < 0.7) {
    recommendations.push(`Develop skills in: ${job.skills.slice(0, 3).join(', ')}`);
  }
  
  if (matchDetails.experienceMatch < 0.6) {
    recommendations.push(`Gain more experience in ${job.category} roles`);
  }
  
  if (matchDetails.languageMatch < 0.8 && job.languages.length > 0) {
    recommendations.push(`Improve language skills: ${job.languages.map(l => l.language).join(', ')}`);
  }
  
  if (matchDetails.salaryMatch < 0.5) {
    recommendations.push("Consider adjusting salary expectations or developing higher-value skills");
  }
  
  return recommendations;
};

// Filtrer et trier les jobs par matching score
const getMatchingJobs = async (jobs, userProfile, userSkills, filters = {}) => {
  const jobsWithScores = await Promise.all(
    jobs.map(async (job) => {
      const matchResult = await calculateJobMatch(job, userProfile, userSkills);
      return {
        job: job.toObject ? job.toObject() : job,
        matchScore: matchResult.score,
        matchDetails: matchResult.details,
        recommendations: matchResult.recommendations
      };
    })
  );
  
  // Appliquer les filtres
  let filteredJobs = jobsWithScores.filter(jobData => {
    const job = jobData.job;
    
    if (filters.category && job.category !== filters.category) return false;
    if (filters.type && job.type !== filters.type) return false;
    if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.minSalary && job.salary.max < filters.minSalary) return false;
    if (filters.experience && job.experience !== filters.experience) return false;
    if (filters.remote !== undefined && job.isRemote !== filters.remote) return false;
    
    return true;
  });
  
  // Trier par score de matching
  filteredJobs.sort((a, b) => b.matchScore - a.matchScore);
  
  return filteredJobs;
};

module.exports = {
  calculateJobMatch,
  getMatchingJobs
};