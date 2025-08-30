import { initializeGemini } from "../services/geminiService.js";
import { generateFeedbackPrompt } from "../utils/promptGenerator.js";
import { getFallbackFeedback, validateAndFixFeedback } from "../utils/feedbackUtils.js";

export async function generateFeedback(req, res) {
  console.log("=== Generate Feedback Request ===");
    console.log("Raw request body:", JSON.stringify(req.body, null, 2));
  
  const { answers, questions, metadata } = req.body;
  
  // Log each answer to see transcript data
  answers.forEach((answer, index) => {
    console.log(`Answer ${index + 1}:`, {
      questionId: answer.questionId,
      hasTranscription: !!answer.transcription,
      transcriptionType: typeof answer.transcription,
      transcriptionPreview: answer.transcription ? 
        (typeof answer.transcription === 'string' ? 
          answer.transcription.substring(0, 100) : 
          JSON.stringify(answer.transcription).substring(0, 100)) : 'None'
    });
  });
  try {
    const { 
      sessionData,
      answers,
      questions,
      metadata
    } = req.body;

    // Validation
    if (!answers || !questions || answers.length === 0) {
      return res.status(400).json({ 
        error: "Missing required fields: answers and questions are required" 
      });
    }

    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key not configured. Please add GEMINI_API_KEY to your .env file" 
      });
    }

    // Initialize Gemini model
    const model = initializeGemini();

    // Generate feedback for each answer
    const feedbackResults = [];
    let overallScores = [];

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const question = questions.find(q => q.id === answer.questionId);
      
      if (!question) {
        console.warn(`Question not found for answer ID: ${answer.questionId}`);
        continue;
      }

      try {
        console.log(`Generating feedback for question ${i + 1}/${answers.length}...`);
        
        // Create prompt for individual question feedback
        const prompt = generateFeedbackPrompt({
          question,
          answer,
          sessionData: sessionData || {}
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let feedback;
        try {
          // Clean the response to extract JSON
          const cleanResponse = responseText
            .replace(/```json\n?|\n?```/g, '')
            .replace(/```\n?|\n?```/g, '')
            .trim();
          
          feedback = JSON.parse(cleanResponse);
          
          // Validate and fix the feedback structure
          feedback = validateAndFixFeedback(feedback, question, answer);
          
        } catch (parseError) {
          console.error(`JSON Parse Error for question ${question.id}:`, parseError);
          console.log("Raw response:", responseText);
          
          // Use fallback feedback
          feedback = getFallbackFeedback(question, answer);
        }

        // Map to frontend expected format
        feedbackResults.push({
          questionId: question.id,
          questionText: question.text,
          questionType: question.type || 'general',
          difficulty: question.difficulty || 'medium',
          coding: question.coding || false,
          score: feedback.score || 60,
          wasAnswered: !answer.skipped,
          hasTranscript: !!(answer.transcription && answer.transcription.text),
          transcription: answer.transcription || null,
          transcriptWordCount: answer.transcription ? 
            (answer.transcription.text ? answer.transcription.text.split(/\s+/).length : 0) : 0,
          detailedFeedback: feedback.assessment || '',
          strengths: feedback.strengths || [],
          improvements: feedback.improvements || [],
          communicationScore: feedback.communicationScore || feedback.score || 60,
          technicalScore: feedback.technicalScore || null,
          completeness: feedback.completeness || feedback.score || 60,
          clarity: feedback.clarity || null
        });

        overallScores.push(feedback.score || 60);

      } catch (error) {
        console.error(`Error generating feedback for question ${question.id}:`, error);
        
        // Use fallback feedback for this question
        const fallbackFeedback = getFallbackFeedback(question, answer);
        feedbackResults.push({
          questionId: question.id,
          questionText: question.text,
          questionType: question.type || 'general',
          difficulty: question.difficulty || 'medium',
          coding: question.coding || false,
          score: 60,
          wasAnswered: !answer.skipped,
          hasTranscript: false,
          transcription: null,
          transcriptWordCount: 0,
          detailedFeedback: 'Unable to generate detailed feedback for this question.',
          strengths: [],
          improvements: ['Consider providing more detailed responses'],
          communicationScore: 60,
          technicalScore: null,
          completeness: 60,
          clarity: null,
          ...fallbackFeedback
        });
        overallScores.push(60);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate metrics
    const answeredQuestions = answers.filter(a => !a.skipped);
    const completionRate = Math.round((answeredQuestions.length / questions.length) * 100);
    const averageScore = Math.round(
      overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length
    );

    // Helper function to calculate grade
    const calculateGrade = (score) => {
      if (score >= 90) return 'A+';
      if (score >= 85) return 'A';
      if (score >= 80) return 'A-';
      if (score >= 75) return 'B+';
      if (score >= 70) return 'B';
      if (score >= 65) return 'B-';
      if (score >= 60) return 'C+';
      if (score >= 55) return 'C';
      if (score >= 50) return 'C-';
      return 'D';
    };

    // Collect strengths and improvements
    const allStrengths = [];
    const allImprovements = [];
    const strongAreas = [];
    const weakAreas = [];

    feedbackResults.forEach(fb => {
      if (fb.score >= 80) {
        allStrengths.push(...(fb.strengths || []));
        strongAreas.push(fb.questionType);
      } else if (fb.score < 65) {
        allImprovements.push(...(fb.improvements || []));
        weakAreas.push(fb.questionType);
      }
    });

    // Remove duplicates and limit
    const uniqueStrengths = [...new Set(allStrengths)].slice(0, 5);
    const uniqueImprovements = [...new Set(allImprovements)].slice(0, 5);

    // Calculate communication metrics
    const questionsWithTranscripts = feedbackResults.filter(f => f.hasTranscript).length;
    const totalWordsSpoken = feedbackResults.reduce((sum, f) => sum + (f.transcriptWordCount || 0), 0);
    const averageWordsPerResponse = questionsWithTranscripts > 0 ? 
      Math.round(totalWordsSpoken / questionsWithTranscripts) : 0;

    // Generate recommendations and next steps
    const recommendations = generateRecommendations(feedbackResults, averageScore);
    const nextSteps = generateNextSteps(feedbackResults, averageScore);

    // Calculate category performance
    const categoryPerformance = calculateCategoryPerformance(feedbackResults, questions);

    // Format response to match frontend expectations
    const feedbackResponse = {
      overallScore: averageScore,
      overallGrade: calculateGrade(averageScore),
      completionRate,
      generatedAt: new Date().toISOString(),
      
      metrics: {
        questionsAnswered: answeredQuestions.length,
        totalQuestions: questions.length,
        averageCommunicationScore: Math.round(
          feedbackResults.reduce((sum, f) => sum + (f.communicationScore || 0), 0) / feedbackResults.length
        ),
        averageTechnicalScore: feedbackResults.some(f => f.technicalScore) ? 
          Math.round(feedbackResults
            .filter(f => f.technicalScore)
            .reduce((sum, f) => sum + f.technicalScore, 0) / 
            feedbackResults.filter(f => f.technicalScore).length) : null,
        totalWordsSpoken,
        averageWordsPerResponse,
        questionsWithTranscripts
      },

      overallStrengths: uniqueStrengths.length > 0 ? uniqueStrengths : [
        'Completed the interview process',
        'Demonstrated engagement with the questions'
      ],
      
      overallImprovements: uniqueImprovements.length > 0 ? uniqueImprovements : [
        'Focus on providing more detailed responses',
        'Practice explaining technical concepts clearly'
      ],

      recommendations,
      nextSteps,
      questionFeedbacks: feedbackResults,
      categoryPerformance,
      
      communicationAnalysis: questionsWithTranscripts > 0 ? {
        totalWordsSpoken,
        averageWordsPerResponse,
        communicationPatterns: {
          brevity: averageWordsPerResponse < 50 ? 'concise' : averageWordsPerResponse > 150 ? 'detailed' : 'balanced',
          technicalLanguageUse: 'moderate'
        }
      } : null,

      interviewMetadata: metadata || {}
    };

    console.log(`Generated feedback for ${feedbackResults.length} questions`);
    console.log(`Overall score: ${averageScore}`);

    res.json({ 
      success: true,
      feedback: feedbackResponse
    });

  } catch (error) {
    console.error("Generate Feedback Error:", error);
    res.status(500).json({ 
      error: "Failed to generate feedback", 
      details: error.message,
      suggestion: "Please check your Gemini API key and try again"
    });
  }
}

// Helper function to generate recommendations
function generateRecommendations(feedbackResults, averageScore) {
  const recommendations = [];
  
  if (averageScore < 60) {
    recommendations.push('Focus on understanding fundamental concepts before moving to advanced topics');
    recommendations.push('Practice explaining your thought process step by step');
    recommendations.push('Take time to think through questions before responding');
  } else if (averageScore < 75) {
    recommendations.push('Work on providing more comprehensive answers with examples');
    recommendations.push('Practice technical interview questions regularly');
    recommendations.push('Focus on explaining the reasoning behind your solutions');
  } else if (averageScore < 85) {
    recommendations.push('Continue practicing advanced scenarios and edge cases');
    recommendations.push('Work on optimizing your solutions and discussing trade-offs');
    recommendations.push('Practice explaining complex concepts in simple terms');
  } else {
    recommendations.push('Maintain your strong performance with continued practice');
    recommendations.push('Focus on leadership and system design questions');
    recommendations.push('Consider mentoring others to reinforce your knowledge');
  }

  // Add specific recommendations based on question types
  const codingQuestions = feedbackResults.filter(f => f.coding);
  if (codingQuestions.length > 0) {
    const avgCodingScore = codingQuestions.reduce((sum, f) => sum + f.score, 0) / codingQuestions.length;
    if (avgCodingScore < 70) {
      recommendations.push('Practice more coding problems on platforms like LeetCode or HackerRank');
      recommendations.push('Focus on understanding time and space complexity');
    }
  }

  return recommendations.slice(0, 5);
}

// Helper function to generate next steps
function generateNextSteps(feedbackResults, averageScore) {
  const nextSteps = [
    'Review the detailed feedback for each question',
    'Practice the areas identified for improvement',
    'Take another mock interview to track progress'
  ];

  if (averageScore < 70) {
    nextSteps.push('Study fundamental concepts in your field');
    nextSteps.push('Practice basic interview questions daily');
  } else {
    nextSteps.push('Practice advanced interview scenarios');
    nextSteps.push('Focus on system design and architectural questions');
  }

  return nextSteps.slice(0, 4);
}

// Helper function to calculate category performance
function calculateCategoryPerformance(feedbackResults, questions) {
  const categories = {};
  
  feedbackResults.forEach(feedback => {
    const category = feedback.questionType || 'general';
    if (!categories[category]) {
      categories[category] = {
        totalQuestions: 0,
        questionsAnswered: 0,
        scores: [],
        transcriptAvailable: 0,
        totalWordsSpoken: 0
      };
    }
    
    categories[category].totalQuestions++;
    if (feedback.wasAnswered) {
      categories[category].questionsAnswered++;
      categories[category].scores.push(feedback.score);
    }
    if (feedback.hasTranscript) {
      categories[category].transcriptAvailable++;
      categories[category].totalWordsSpoken += feedback.transcriptWordCount || 0;
    }
  });

  // Calculate averages and completion rates
  Object.keys(categories).forEach(category => {
    const cat = categories[category];
    cat.averageScore = cat.scores.length > 0 ? 
      Math.round(cat.scores.reduce((sum, score) => sum + score, 0) / cat.scores.length) : 0;
    cat.completionRate = Math.round((cat.questionsAnswered / cat.totalQuestions) * 100);
    cat.averageWordsSpoken = cat.transcriptAvailable > 0 ? 
      Math.round(cat.totalWordsSpoken / cat.transcriptAvailable) : 0;
  });

  return categories;
}

// Get saved feedback (if implemented with database)
export function getSavedFeedback(req, res) {
  try {
    const { sessionId } = req.params;
    
    // Placeholder for database lookup
    // In a real implementation, you would query your database here
    console.log("Getting saved feedback for session:", sessionId);
    
    res.json({ 
      message: "Feedback retrieval not implemented yet",
      sessionId
    });
  } catch (error) {
    console.error("Error retrieving feedback:", error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}