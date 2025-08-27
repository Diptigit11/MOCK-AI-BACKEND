export function validateAndFixFeedback(feedback, question, answer) {
  const validatedFeedback = {
    score: feedback.score || 60,
    assessment: feedback.assessment || "Assessment not available",
    strengths: Array.isArray(feedback.strengths) ? feedback.strengths : [],
    improvements: Array.isArray(feedback.improvements) ? feedback.improvements : [],
    suggestions: Array.isArray(feedback.suggestions) ? feedback.suggestions : [],
    keywordsCovered: Array.isArray(feedback.keywordsCovered) ? feedback.keywordsCovered : [],
    missedOpportunities: Array.isArray(feedback.missedOpportunities) ? feedback.missedOpportunities : [],
  };

  if (validatedFeedback.score < 0) validatedFeedback.score = 0;
  if (validatedFeedback.score > 100) validatedFeedback.score = 100;

  validatedFeedback.strengths = validatedFeedback.strengths.slice(0, 5);
  validatedFeedback.improvements = validatedFeedback.improvements.slice(0, 5);
  validatedFeedback.suggestions = validatedFeedback.suggestions.slice(0, 5);
  validatedFeedback.keywordsCovered = validatedFeedback.keywordsCovered.slice(0, 8);
  validatedFeedback.missedOpportunities = validatedFeedback.missedOpportunities.slice(0, 5);

  // Add contextual information
  validatedFeedback.responseType = answer.skipped ? 'skipped' : 
                                  question.coding ? 'code' : 'audio';
  validatedFeedback.answered = !answer.skipped;

  return validatedFeedback;
}

export function getFallbackFeedback(question, answer) {
  const isSkipped = answer.skipped;
  const isCoding = question.coding;
  const difficulty = question.difficulty;
  
  let baseScore = isSkipped ? 0 : 
                  isCoding ? 50 : 55;

  // Adjust score based on difficulty
  if (difficulty === 'easy') baseScore += 10;
  else if (difficulty === 'hard') baseScore -= 10;

  const fallbackFeedback = {
    score: Math.max(0, Math.min(100, baseScore)),
    assessment: isSkipped ? 
      "Question was not attempted. This indicates a gap in knowledge or time management." :
      isCoding ?
        "Code submission detected but detailed analysis unavailable. Basic problem-solving approach assumed." :
        "Audio response recorded but detailed analysis unavailable. Communication attempt noted.",
    
    strengths: isSkipped ? [] : 
               isCoding ? 
                 ["Attempted the coding challenge", "Code structure shows basic understanding"] :
                 ["Provided a response", "Communication attempt demonstrates engagement"],
    
    improvements: isSkipped ?
      [`Study ${question.type} concepts`, "Practice time management", "Build confidence in this area"] :
      isCoding ?
        ["Code optimization", "Edge case handling", "Algorithm efficiency"] :
        ["Technical depth", "Specific examples", "Structured responses"],
    
    suggestions: isSkipped ?
      [`Review ${difficulty} level ${question.type} questions`, "Practice similar problems", "Allocate time better"] :
      isCoding ?
        ["Practice coding problems daily", "Review algorithm fundamentals", "Write cleaner code"] :
        ["Use the STAR method", "Provide concrete examples", "Practice technical explanations"],
    
    keywordsCovered: isSkipped ? [] : 
                     [`${question.type}`, `${difficulty} level`],
    
    missedOpportunities: isSkipped ?
      ["Complete understanding of the topic", "Demonstration of problem-solving skills"] :
      isCoding ?
        ["Code comments", "Time complexity analysis", "Alternative solutions"] :
        ["Technical details", "Real-world applications", "Follow-up questions"],
    
    responseType: isSkipped ? 'skipped' : (isCoding ? 'code' : 'audio'),
    answered: !isSkipped
  };

  return fallbackFeedback;
}

export function calculateOverallMetrics(feedbackResults) {
  if (!feedbackResults.length) {
    return {
      overallScore: 0,
      averageScore: 0,
      scoreDistribution: { excellent: 0, good: 0, average: 0, needsImprovement: 0 }
    };
  }

  const scores = feedbackResults.map(fb => fb.score || 0);
  const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

  const scoreDistribution = {
    excellent: scores.filter(score => score >= 90).length,
    good: scores.filter(score => score >= 75 && score < 90).length,
    average: scores.filter(score => score >= 60 && score < 75).length,
    needsImprovement: scores.filter(score => score < 60).length
  };

  return {
    overallScore: averageScore,
    averageScore,
    scoreDistribution
  };
}

export function extractCommonThemes(feedbackResults) {
  const allStrengths = [];
  const allImprovements = [];
  const allKeywords = [];

  feedbackResults.forEach(fb => {
    allStrengths.push(...(fb.strengths || []));
    allImprovements.push(...(fb.improvements || []));
    allKeywords.push(...(fb.keywordsCovered || []));
  });

  // Count frequency and get most common
  const strengthCounts = {};
  const improvementCounts = {};
  const keywordCounts = {};

  allStrengths.forEach(strength => {
    strengthCounts[strength] = (strengthCounts[strength] || 0) + 1;
  });

  allImprovements.forEach(improvement => {
    improvementCounts[improvement] = (improvementCounts[improvement] || 0) + 1;
  });

  allKeywords.forEach(keyword => {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  });

  return {
    commonStrengths: Object.keys(strengthCounts)
      .sort((a, b) => strengthCounts[b] - strengthCounts[a])
      .slice(0, 5),
    commonImprovements: Object.keys(improvementCounts)
      .sort((a, b) => improvementCounts[b] - improvementCounts[a])
      .slice(0, 5),
    commonKeywords: Object.keys(keywordCounts)
      .sort((a, b) => keywordCounts[b] - keywordCounts[a])
      .slice(0, 10)
  };
}