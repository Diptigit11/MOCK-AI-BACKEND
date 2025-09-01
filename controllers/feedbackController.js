// controllers/feedbackController.js - Fixed for Coding Questions
import mongoose from "mongoose";
import { initializeGemini } from "../services/geminiService.js";
import { generateFeedbackPrompt } from "../utils/promptGenerator.js";
import { getFallbackFeedback, validateAndFixFeedback } from "../utils/feedbackUtils.js";
import { Session, Question, Feedback } from "../models/Feedback.js";

export async function generateFeedback(req, res) {
  console.log("=== Generate Feedback Request ===");
  console.log("Raw request body:", JSON.stringify(req.body, null, 2));
  
  const { answers, questions, metadata } = req.body;
  const userId = req.user._id; // From your protect middleware
  
  // Log each answer to see transcript/code data
  answers.forEach((answer, index) => {
    console.log(`Answer ${index + 1}:`, {
      questionId: answer.questionId,
      hasTranscription: !!answer.transcription,
      hasCode: !!answer.code,
      skipped: !!answer.skipped,
      answerType: answer.code ? 'code' : (answer.transcription ? 'voice' : 'skipped')
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

    // Create or find session
    const sessionId = sessionData?.id || `session_${Date.now()}_${userId}`;
    let session = await Session.findById(sessionId);
    
    if (!session) {
      session = new Session({
        _id: sessionId,
        userId: userId,
        jobRole: metadata?.jobRole || metadata?.role || 'Not specified',
        metadata: metadata || {}
      });
      await session.save();
      console.log("Created new session:", sessionId);
    } else {
      // Verify session belongs to user
      if (session.userId.toString() !== userId.toString()) {
        return res.status(403).json({ 
          error: "Unauthorized access to session" 
        });
      }
    }

    // Save questions if they don't exist
    for (const question of questions) {
      try {
        const existingQuestion = await Question.findById(question.id);
        if (!existingQuestion) {
          const newQuestion = new Question({
            _id: question.id,
            text: question.text,
            type: question.type || 'general',
            difficulty: question.difficulty || 'medium',
            coding: question.coding || false
          });
          await newQuestion.save();
          console.log("Saved new question:", question.id);
        }
      } catch (questionError) {
        console.warn("Error saving question:", question.id, questionError.message);
      }
    }

    // Initialize Gemini model
    const model = initializeGemini();

    // Generate feedback for each answer
    const feedbackResults = [];
    const detailedFeedbackArray = []; // For old format compatibility
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

        // NEW: Handle coding vs voice questions differently
        const isCodingQuestion = question.coding || false;
        const hasUserResponse = isCodingQuestion ? !!answer.code : !!(answer.transcription && answer.transcription.text);
        
        // New format for questionFeedbacks
        const newFormatFeedback = {
          questionId: question.id,
          questionText: question.text,
          questionType: question.type || 'general',
          difficulty: question.difficulty || 'medium',
          coding: isCodingQuestion,
          score: feedback.score || 60,
          wasAnswered: !answer.skipped,
          
          // Handle transcription vs code differently
          hasTranscript: !isCodingQuestion && !!(answer.transcription && answer.transcription.text),
          transcription: !isCodingQuestion ? (answer.transcription || null) : null,
          transcriptWordCount: !isCodingQuestion && answer.transcription ? 
            (answer.transcription.text ? answer.transcription.text.split(/\s+/).length : 0) : 0,
          
          // Add code fields for coding questions
          hasCode: isCodingQuestion && !!answer.code,
          code: isCodingQuestion ? (answer.code || null) : null,
          codeLength: isCodingQuestion && answer.code ? answer.code.length : 0,
          
          detailedFeedback: feedback.assessment || '',
          strengths: feedback.strengths || [],
          improvements: feedback.improvements || [],
          communicationScore: feedback.communicationScore || feedback.score || 60,
          technicalScore: feedback.technicalScore || null,
          completeness: feedback.completeness || feedback.score || 60,
          clarity: feedback.clarity || null
        };

        // Old format for backward compatibility - handle coding vs voice
        const getUserAnswer = () => {
          if (answer.skipped) return 'Question was skipped';
          if (isCodingQuestion) {
            return answer.code || 'No code submitted';
          } else {
            return answer.transcription?.text || 'No transcript available';
          }
        };

        const oldFormatFeedback = {
          questionId: question.id,
          questionText: question.text,
          userAnswer: getUserAnswer(),
          score: feedback.score || 60,
          feedback: feedback.assessment || '',
          strengths: feedback.strengths || [],
          improvements: feedback.improvements || []
        };

  feedbackResults.push(newFormatFeedback);
        detailedFeedbackArray.push(oldFormatFeedback);
        
        // Include score for answered questions, 0 for skipped
        if (answer.skipped) {
          overallScores.push(0); // Skipped = 0 points
        } else {
          overallScores.push(feedback.score || 60);
        }

      } catch (error) {
        console.error(`Error generating feedback for question ${question.id}:`, error);
        
        // Use fallback feedback for this question
        const fallbackFeedback = getFallbackFeedback(question, answer);
        
        const isCodingQuestion = question.coding || false;
        
        const newFormatFallback = {
          questionId: question.id,
          questionText: question.text,
          questionType: question.type || 'general',
          difficulty: question.difficulty || 'medium',
          coding: isCodingQuestion,
          score: 60,
          wasAnswered: !answer.skipped,
          hasTranscript: !isCodingQuestion && !!(answer.transcription && answer.transcription.text),
          transcription: !isCodingQuestion ? (answer.transcription || null) : null,
          transcriptWordCount: 0,
          hasCode: isCodingQuestion && !!answer.code,
          code: isCodingQuestion ? (answer.code || null) : null,
          codeLength: 0,
          detailedFeedback: 'Unable to generate detailed feedback for this question.',
          strengths: [],
          improvements: ['Consider providing more detailed responses'],
          communicationScore: 60,
          technicalScore: null,
          completeness: 60,
          clarity: null,
          ...fallbackFeedback
        };

        const getUserAnswerFallback = () => {
          if (answer.skipped) return 'Question was skipped';
          if (isCodingQuestion) {
            return answer.code || 'No code submitted';
          } else {
            return answer.transcription?.text || 'No transcript available';
          }
        };

        const oldFormatFallback = {
          questionId: question.id,
          questionText: question.text,
          userAnswer: getUserAnswerFallback(),
          score: 60,
          feedback: 'Unable to generate detailed feedback for this question.',
          strengths: [],
          improvements: ['Consider providing more detailed responses']
        };

         feedbackResults.push(newFormatFallback);
        detailedFeedbackArray.push(oldFormatFallback);
        
        // Include score for answered questions, 0 for skipped
        if (answer.skipped) {
          overallScores.push(0); // Skipped = 0 points
        } else {
          overallScores.push(60);
        }
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate metrics
    const answeredQuestions = answers.filter(a => !a.skipped);
   const completionRate = Math.round((answeredQuestions.length / questions.length) * 100);
    const averageScore = Math.round(
      overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length
    ); // This now correctly includes 0 for skipped questions


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

    // Calculate communication metrics (only for voice questions)
    const voiceQuestions = feedbackResults.filter(f => f.hasTranscript);
    const questionsWithTranscripts = voiceQuestions.length;
    const totalWordsSpoken = voiceQuestions.reduce((sum, f) => sum + (f.transcriptWordCount || 0), 0);
    const averageWordsPerResponse = questionsWithTranscripts > 0 ? 
      Math.round(totalWordsSpoken / questionsWithTranscripts) : 0;

    // Generate recommendations and next steps
    const recommendations = generateRecommendations(feedbackResults, averageScore);
    const nextSteps = generateNextSteps(feedbackResults, averageScore);

    // Calculate category performance
    const categoryPerformance = calculateCategoryPerformance(feedbackResults, questions);

    // Save feedback to database (both old and new format)
    try {
      // Check if feedback already exists for this session
      const existingFeedback = await Feedback.findOne({ sessionId: sessionId, userId: userId });
      
      const feedbackData = {
        // OLD FORMAT FIELDS (for backward compatibility)
        userId: userId,
        sessionId: sessionId,
        role: metadata?.jobRole || metadata?.role || 'Not specified',
        company: metadata?.company || 'Not specified',
        interviewType: metadata?.interviewType || 'technical',
        difficulty: metadata?.difficulty || 'medium',
        overallScore: averageScore,
        totalQuestions: questions.length,
        answeredQuestions: answeredQuestions.length,
        skippedQuestions: questions.length - answeredQuestions.length,
        codingQuestions: questions.filter(q => q.coding).length,
        averageTimePerQuestion: metadata?.averageTimePerQuestion || 0,
        totalInterviewTime: metadata?.totalInterviewTime || 0,
        strengths: uniqueStrengths,
        improvements: uniqueImprovements,
        strongAreas: [...new Set(strongAreas)],
        weakAreas: [...new Set(weakAreas)],
        scoreDistribution: categoryPerformance,
        detailedFeedback: detailedFeedbackArray,
        resumeProcessed: metadata?.resumeProcessed || false,
        language: metadata?.language || 'javascript',
        generatedAt: new Date(),
        
        // NEW FORMAT FIELDS (enhanced)
        overallGrade: calculateGrade(averageScore),
        completionRate: completionRate,
        
        enhancedMetrics: {
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
          questionsWithTranscripts,
          // NEW: Add coding metrics
          codingQuestionsAttempted: feedbackResults.filter(f => f.coding && f.hasCode).length,
          totalCodeLength: feedbackResults.reduce((sum, f) => sum + (f.codeLength || 0), 0)
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
        categoryPerformance: new Map(Object.entries(categoryPerformance)),
        
        communicationAnalysis: questionsWithTranscripts > 0 ? {
          totalWordsSpoken,
          averageWordsPerResponse,
          communicationPatterns: {
            brevity: averageWordsPerResponse < 50 ? 'concise' : averageWordsPerResponse > 150 ? 'detailed' : 'balanced',
            technicalLanguageUse: 'moderate'
          }
        } : null,

        interviewMetadata: metadata || {},
        feedbackVersion: 'v2'
      };
      
      if (existingFeedback) {
        // Update existing feedback
        Object.assign(existingFeedback, feedbackData);
        await existingFeedback.save();
        console.log("Updated existing feedback for session:", sessionId);
      } else {
        // Create new feedback
        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();
        console.log("Saved new feedback for session:", sessionId);
      }
    } catch (dbError) {
      console.error("Database save error:", dbError);
      // Continue execution - don't fail the request if DB save fails
    }

    // Format response for frontend (return new format)
    const responseData = {
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
        questionsWithTranscripts,
        // NEW: Add coding metrics to response
        codingQuestionsAttempted: feedbackResults.filter(f => f.coding && f.hasCode).length,
        totalCodeLength: feedbackResults.reduce((sum, f) => sum + (f.codeLength || 0), 0)
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
    console.log(`Voice questions: ${questionsWithTranscripts}, Coding questions: ${feedbackResults.filter(f => f.coding).length}`);

    res.json({ 
      success: true,
      feedback: responseData
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

// Get saved feedback by session ID - FIXED to handle coding questions
export async function getSavedFeedback(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id; // From your middleware
    
    console.log("Getting saved feedback for session:", sessionId, "user:", userId);
    
    // Find feedback for the specific session and user
    const feedback = await Feedback.findOne({ 
      sessionId: sessionId,
      userId: userId 
    }).populate('userId', 'firstName lastName email');
    
    if (!feedback) {
      return res.status(404).json({ 
        error: "Feedback not found or you don't have permission to access it",
        sessionId
      });
    }
    
    // Return in new format if it's v2, otherwise convert from old format
    let responseData;
    if (feedback.feedbackVersion === 'v2' && feedback.questionFeedbacks && feedback.questionFeedbacks.length > 0) {
      // Return new enhanced format
      responseData = {
        overallScore: feedback.overallScore,
        overallGrade: feedback.overallGrade,
        completionRate: feedback.completionRate,
        generatedAt: feedback.generatedAt,
        metrics: {
          questionsAnswered: feedback.answeredQuestions,
          totalQuestions: feedback.totalQuestions,
          averageCommunicationScore: feedback.enhancedMetrics?.averageCommunicationScore,
          averageTechnicalScore: feedback.enhancedMetrics?.averageTechnicalScore,
          totalWordsSpoken: feedback.enhancedMetrics?.totalWordsSpoken || 0,
          averageWordsPerResponse: feedback.enhancedMetrics?.averageWordsPerResponse || 0,
          questionsWithTranscripts: feedback.enhancedMetrics?.questionsWithTranscripts || 0,
          codingQuestionsAttempted: feedback.enhancedMetrics?.codingQuestionsAttempted || 0,
          totalCodeLength: feedback.enhancedMetrics?.totalCodeLength || 0
        },
        overallStrengths: feedback.overallStrengths,
        overallImprovements: feedback.overallImprovements,
        recommendations: feedback.recommendations,
        nextSteps: feedback.nextSteps,
        questionFeedbacks: feedback.questionFeedbacks,
        categoryPerformance: Object.fromEntries(feedback.categoryPerformance || new Map()),
        communicationAnalysis: feedback.communicationAnalysis,
        interviewMetadata: feedback.interviewMetadata
      };
    } else {
      // Convert old format to new format for consistency
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

      responseData = {
        overallScore: feedback.overallScore,
        overallGrade: feedback.overallGrade || calculateGrade(feedback.overallScore),
        completionRate: Math.round((feedback.answeredQuestions / feedback.totalQuestions) * 100),
        generatedAt: feedback.generatedAt,
        metrics: {
          questionsAnswered: feedback.answeredQuestions,
          totalQuestions: feedback.totalQuestions,
          averageCommunicationScore: feedback.overallScore,
          averageTechnicalScore: null,
          totalWordsSpoken: 0,
          averageWordsPerResponse: 0,
          questionsWithTranscripts: 0,
          codingQuestionsAttempted: 0,
          totalCodeLength: 0
        },
        overallStrengths: feedback.strengths,
        overallImprovements: feedback.improvements,
        recommendations: feedback.recommendations || generateRecommendations([], feedback.overallScore),
        nextSteps: feedback.nextSteps || generateNextSteps([], feedback.overallScore),
        questionFeedbacks: feedback.detailedFeedback?.map(detail => {
          // Better logic to detect if this is a coding question
          const isCodingQuestion = detail.userAnswer && 
            (detail.userAnswer.includes('def ') || 
             detail.userAnswer.includes('function ') || 
             detail.userAnswer.includes('class ') ||
             detail.userAnswer.includes('const ') ||
             detail.userAnswer.includes('let ') ||
             detail.userAnswer.includes('var ') ||
             detail.userAnswer.includes('import ') ||
             detail.userAnswer.includes('from ') ||
             detail.userAnswer.includes('return ') ||
             detail.userAnswer.match(/[\{\}\[\];]/)) && 
            detail.userAnswer !== 'No transcript available' &&
            detail.userAnswer !== 'Question was skipped';

          const isSkipped = detail.userAnswer === 'Question was skipped';
          const hasValidAnswer = detail.userAnswer && 
            detail.userAnswer !== 'No transcript available' && 
            detail.userAnswer !== 'Question was skipped';

          return {
            questionId: detail.questionId,
            questionText: detail.questionText,
            questionType: 'technical',
            difficulty: feedback.difficulty,
            coding: isCodingQuestion,
            score: detail.score || feedback.overallScore,
            wasAnswered: hasValidAnswer,
            hasTranscript: !isCodingQuestion && hasValidAnswer,
            transcription: (!isCodingQuestion && hasValidAnswer) ? 
              { text: detail.userAnswer, confidence: 0.9 } : null,
            transcriptWordCount: (!isCodingQuestion && hasValidAnswer) ? 
              detail.userAnswer.split(/\s+/).length : 0,
            hasCode: isCodingQuestion,
            code: isCodingQuestion ? detail.userAnswer : null,
            codeLength: isCodingQuestion ? detail.userAnswer.length : 0,
            detailedFeedback: detail.feedback || '',
            strengths: detail.strengths || [],
            improvements: detail.improvements || [],
            communicationScore: detail.score || feedback.overallScore,
            technicalScore: isCodingQuestion ? (detail.score || feedback.overallScore) : null,
            completeness: detail.score || feedback.overallScore,
            clarity: null
          };
        }) || [],
        categoryPerformance: feedback.scoreDistribution || {},
        communicationAnalysis: null,
        interviewMetadata: {
          jobRole: feedback.role,
          company: feedback.company,
          interviewType: feedback.interviewType,
          difficulty: feedback.difficulty,
          language: feedback.language
        }
      };
    }
    
    res.json({ 
      success: true,
      feedback: responseData
    });
    
  } catch (error) {
    console.error("Error retrieving feedback:", error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}

// Rest of the functions remain the same...
export async function getUserFeedbackHistory(req, res) {
  try {
    const userId = req.user._id; // From your middleware
    const { page = 1, limit = 10, sortBy = 'generatedAt', sortOrder = 'desc' } = req.query;
    
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Get user's feedback with pagination
    const feedbackHistory = await Feedback.find({ userId })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('sessionId overallScore overallGrade completionRate generatedAt answeredQuestions totalQuestions role company interviewType')
      .populate('userId', 'firstName lastName');
    
    // Get total count for pagination
    const totalCount = await Feedback.countDocuments({ userId });
    
    // Format response
    const formattedHistory = feedbackHistory.map(feedback => ({
      sessionId: feedback.sessionId,
      overallScore: feedback.overallScore,
      overallGrade: feedback.overallGrade || calculateGrade(feedback.overallScore),
      completionRate: feedback.completionRate || Math.round((feedback.answeredQuestions / feedback.totalQuestions) * 100),
      generatedAt: feedback.generatedAt,
      questionsAnswered: feedback.answeredQuestions,
      totalQuestions: feedback.totalQuestions,
      jobRole: feedback.role,
      company: feedback.company,
      interviewType: feedback.interviewType
    }));
    
    res.json({
      success: true,
      feedback: formattedHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error("Error retrieving feedback history:", error);
    res.status(500).json({ error: "Failed to retrieve feedback history" });
  }
}

// Helper function to calculate grade
function calculateGrade(score) {
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
      recommendations.push('Work on writing cleaner, more readable code with proper variable names');
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
        totalWordsSpoken: 0,
        codeSubmissions: 0,
        totalCodeLength: 0
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
    if (feedback.hasCode) {
      categories[category].codeSubmissions++;
      categories[category].totalCodeLength += feedback.codeLength || 0;
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
    cat.averageCodeLength = cat.codeSubmissions > 0 ?
      Math.round(cat.totalCodeLength / cat.codeSubmissions) : 0;
  });

  return categories;
}


// Get feedback by session ID
export async function getFeedbackBySessionId(req, res) {
  try {
    const { sessionId } = req.params;
    
    console.log("Getting feedback for session:", sessionId);
    
    // Find feedback by session ID
    const feedback = await Feedback.findOne({ 
      sessionId: sessionId,
      deleted: { $ne: true } // Exclude soft-deleted records
    }).populate('userId', 'firstName lastName email');
    
    if (!feedback) {
      return res.status(404).json({ 
        error: "Feedback not found for this session",
        sessionId
      });
    }
    
    // Verify user has permission to access this feedback
    if (req.user._id.toString() !== feedback.userId._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: "Unauthorized access to this feedback" 
      });
    }
    
    // Format the response based on feedback version
    let responseData;
    
    if (feedback.feedbackVersion === 'v2' && feedback.questionFeedbacks) {
      // New enhanced format
      responseData = {
        id: feedback._id,
        sessionId: feedback.sessionId,
        overallScore: feedback.overallScore,
        overallGrade: feedback.overallGrade,
        completionRate: feedback.completionRate,
        generatedAt: feedback.generatedAt,

        // Add the missing fields
        role: feedback.role,
        answeredQuestions: feedback.answeredQuestions,
        skippedQuestions: feedback.skippedQuestions,
        codingQuestions: feedback.codingQuestions,
        averageTimePerQuestion: feedback.averageTimePerQuestion,
        totalInterviewTime: feedback.totalInterviewTime,
        strongAreas: feedback.strongAreas,
        weakAreas: feedback.weakAreas,
        scoreDistribution: feedback.scoreDistribution,
        resumeProcessed: feedback.resumeProcessed,

        metrics: {
          questionsAnswered: feedback.answeredQuestions,
          totalQuestions: feedback.totalQuestions,
          averageCommunicationScore: feedback.enhancedMetrics?.averageCommunicationScore,
          averageTechnicalScore: feedback.enhancedMetrics?.averageTechnicalScore,
          totalWordsSpoken: feedback.enhancedMetrics?.totalWordsSpoken || 0,
          averageWordsPerResponse: feedback.enhancedMetrics?.averageWordsPerResponse || 0,
          questionsWithTranscripts: feedback.enhancedMetrics?.questionsWithTranscripts || 0,
          codingQuestionsAttempted: feedback.enhancedMetrics?.codingQuestionsAttempted || 0,
          totalCodeLength: feedback.enhancedMetrics?.totalCodeLength || 0
        },
        
        overallStrengths: feedback.overallStrengths,
        overallImprovements: feedback.overallImprovements,
        recommendations: feedback.recommendations,
        nextSteps: feedback.nextSteps,
        questionFeedbacks: feedback.questionFeedbacks,
        categoryPerformance: Object.fromEntries(feedback.categoryPerformance || new Map()),
        communicationAnalysis: feedback.communicationAnalysis,
        
        interviewMetadata: {
          jobRole: feedback.role,
          company: feedback.company,
          interviewType: feedback.interviewType,
          difficulty: feedback.difficulty,
          language: feedback.language,
          ...feedback.interviewMetadata
        },
        
        user: {
          id: feedback.userId._id,
          name: `${feedback.userId.firstName} ${feedback.userId.lastName}`,
          email: feedback.userId.email
        }
      };
    } else {
      // Old format - convert for consistency
      responseData = {
        id: feedback._id,
        sessionId: feedback.sessionId,
        overallScore: feedback.overallScore,
        overallGrade: feedback.overallGrade || calculateGrade(feedback.overallScore),
        completionRate: Math.round((feedback.answeredQuestions / feedback.totalQuestions) * 100),
        generatedAt: feedback.generatedAt,

        // Add the missing fields
        role: feedback.role,
        answeredQuestions: feedback.answeredQuestions,
        skippedQuestions: feedback.skippedQuestions,
        codingQuestions: feedback.codingQuestions,
        averageTimePerQuestion: feedback.averageTimePerQuestion,
        totalInterviewTime: feedback.totalInterviewTime,
        strongAreas: feedback.strongAreas,
        weakAreas: feedback.weakAreas,
        scoreDistribution: feedback.scoreDistribution,
        resumeProcessed: feedback.resumeProcessed,
        
        metrics: {
          questionsAnswered: feedback.answeredQuestions,
          totalQuestions: feedback.totalQuestions,
          averageCommunicationScore: feedback.overallScore,
          averageTechnicalScore: null,
          totalWordsSpoken: 0,
          averageWordsPerResponse: 0,
          questionsWithTranscripts: 0,
          codingQuestionsAttempted: 0,
          totalCodeLength: 0
        },
        
        overallStrengths: feedback.strengths || [],
        overallImprovements: feedback.improvements || [],
        recommendations: feedback.recommendations || [],
        nextSteps: feedback.nextSteps || [],
        questionFeedbacks: feedback.detailedFeedback?.map(detail => ({
          questionId: detail.questionId,
          questionText: detail.questionText,
          questionType: 'technical',
          difficulty: feedback.difficulty,
          coding: false,
          score: detail.score || feedback.overallScore,
          wasAnswered: true,
          hasTranscript: false,
          transcription: null,
          transcriptWordCount: 0,
          hasCode: false,
          code: null,
          codeLength: 0,
          detailedFeedback: detail.feedback || '',
          strengths: detail.strengths || [],
          improvements: detail.improvements || [],
          communicationScore: detail.score || feedback.overallScore,
          technicalScore: null,
          completeness: detail.score || feedback.overallScore,
          clarity: null
        })) || [],
        categoryPerformance: feedback.scoreDistribution || {},
        communicationAnalysis: null,
        
        interviewMetadata: {
          jobRole: feedback.role,
          company: feedback.company,
          interviewType: feedback.interviewType,
          difficulty: feedback.difficulty,
          language: feedback.language
        },
        
        user: {
          id: feedback.userId._id,
          name: `${feedback.userId.firstName} ${feedback.userId.lastName}`,
          email: feedback.userId.email
        }
      };
    }
    
    res.json({ 
      success: true,
      feedback: responseData
    });
    
  } catch (error) {
    console.error("Error retrieving feedback by session ID:", error);
    res.status(500).json({ 
      error: "Failed to retrieve feedback",
      details: error.message 
    });
  }
}

// Get all feedback for a specific user
export async function getFeedbackByUserId(req, res) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    console.log("Getting feedback for user:", userId);
    
    // Verify user has permission (can only access own data or admin access)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: "Unauthorized access to user feedback" 
      });
    }
    
    // Pagination setup
    const skip = (page - 1) * limit;
    
    // Find all feedback for the user
    const feedback = await Feedback.find({ 
      userId: userId,
      deleted: { $ne: true } // Exclude soft-deleted records
    })
    .sort({ generatedAt: -1 }) // Most recent first
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'firstName lastName email');
    
    // Get total count for pagination
    const totalCount = await Feedback.countDocuments({ 
      userId: userId,
      deleted: { $ne: true }
    });
    
    if (feedback.length === 0) {
      return res.json({
        success: true,
        message: "No feedback found for this user",
        feedback: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }
    
    // Format the feedback data
    const formattedFeedback = feedback.map(fb => ({
      id: fb._id,
      sessionId: fb.sessionId,
      overallScore: fb.overallScore,
      overallGrade: fb.overallGrade || calculateGrade(fb.overallScore),
      completionRate: fb.completionRate || Math.round((fb.answeredQuestions / fb.totalQuestions) * 100),
      generatedAt: fb.generatedAt,
      questionsAnswered: fb.answeredQuestions,
      totalQuestions: fb.totalQuestions,
      jobRole: fb.role,
      company: fb.company,
      interviewType: fb.interviewType,
      difficulty: fb.difficulty,
      language: fb.language,
      strengths: fb.overallStrengths || fb.strengths || [],
      improvements: fb.overallImprovements || fb.improvements || [],
      recommendations: fb.recommendations || [],
      questionFeedbacks: fb.questionFeedbacks || fb.detailedFeedback || []
    }));
    
    res.json({
      success: true,
      feedback: formattedFeedback,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      user: feedback[0].userId
    });
    
  } catch (error) {
    console.error("Error retrieving feedback by user ID:", error);
    res.status(500).json({ 
      error: "Failed to retrieve feedback",
      details: error.message 
    });
  }
}

// 📊 Analytics controller
// ===================== USER ANALYTICS =====================
export async function getFeedbackAnalyticsByUserId(req, res) {
  try {
    const { userId } = req.params;

    // 🔒 Only allow user to see their own analytics (unless admin)
    if (req.user._id.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized access to analytics" });
    }

    // Get all feedbacks for this user (oldest → newest)
    const feedbacks = await Feedback.find({ userId, deleted: { $ne: true } }).sort({ generatedAt: 1 });

    if (!feedbacks.length) {
      return res.json({
        success: true,
        analytics: {
          totalInterviews: 0,
          avgScore: 0,
          bestScore: 0,
          worstScore: 0,
          avgCompletionRate: 0,
          gradeDistribution: {},
          mostCommonStrengths: [],
          mostCommonImprovements: [],
          scoreTrend: [],
          rollingAvgTrend: [],
          lastInterview: null,
          progress: 0
        }
      });
    }

    // ---- Compute Metrics ----
    const totalInterviews = feedbacks.length;

    const scores = feedbacks.map(f => f.overallScore || 0).filter(s => s > 0);
    const completionRates = feedbacks.map(f => f.completionRate || Math.round((f.answeredQuestions / f.totalQuestions) * 100)).filter(r => r > 0);

    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;
    const worstScore = scores.length ? Math.min(...scores) : 0;
    const avgCompletionRate = completionRates.length ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length) : 0;

    // Grade distribution
    const gradeDistribution = {};
    feedbacks.forEach(fb => {
      const grade = fb.overallGrade || "N/A";
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    // Strengths + Improvements frequency
    const strengthCounts = {};
    const improvementCounts = {};

    feedbacks.forEach(fb => {
      (fb.overallStrengths || fb.strengths || []).forEach(s => {
        strengthCounts[s] = (strengthCounts[s] || 0) + 1;
      });
      (fb.overallImprovements || fb.improvements || []).forEach(i => {
        improvementCounts[i] = (improvementCounts[i] || 0) + 1;
      });
    });

    const mostCommonStrengths = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    const mostCommonImprovements = Object.entries(improvementCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    // Score timeline
    const scoreTrend = feedbacks.map(fb => ({
      date: fb.generatedAt,
      score: fb.overallScore || 0
    }));

    // 🔹 Rolling 3-interview average
    const rollingAvgTrend = feedbacks.map((fb, index) => {
      const window = feedbacks.slice(Math.max(0, index - 2), index + 1);
      const windowScores = window.map(f => f.overallScore || 0);
      const avg = windowScores.length ? Math.round(windowScores.reduce((a, b) => a + b, 0) / windowScores.length) : 0;
      return {
        date: fb.generatedAt,
        rollingAvg: avg
      };
    });

    // Last Interview
    const last = feedbacks[feedbacks.length - 1];
    const lastInterview = {
      score: last.overallScore || 0,
      grade: last.overallGrade || "N/A",
      strengths: last.overallStrengths || last.strengths || [],
      improvements: last.overallImprovements || last.improvements || []
    };

    // Progress (improvement from first to last)
    const firstScore = feedbacks[0].overallScore || 0;
    const lastScore = last.overallScore || 0;
    let progress = 0;
    if (firstScore > 0) {
      progress = Math.round(((lastScore - firstScore) / firstScore) * 100);
    }

    // ---- Send Response ----
    res.json({
      success: true,
      analytics: {
        totalInterviews,
        avgScore,
        bestScore,
        worstScore,
        avgCompletionRate,
        gradeDistribution,
        mostCommonStrengths,
        mostCommonImprovements,
        scoreTrend,
        rollingAvgTrend, // 🔥 NEW metric
        lastInterview,
        progress
      }
    });

  } catch (error) {
    console.error("Error generating analytics:", error);
    res.status(500).json({
      error: "Failed to generate analytics",
      details: error.message
    });
  }
}

