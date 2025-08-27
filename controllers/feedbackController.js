import { initializeGemini } from "../services/geminiService.js";
import { generateFeedbackPrompt } from "../utils/promptGenerator.js";
import { getFallbackFeedback, validateAndFixFeedback } from "../utils/feedbackUtils.js";

export async function generateFeedback(req, res) {
  console.log("=== Generate Feedback Request ===");
  console.log("Body:", req.body);

  try {
    const { 
      sessionData,
      answers,
      questions
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

        feedbackResults.push({
          questionId: question.id,
          questionText: question.text,
          questionType: question.type,
          difficulty: question.difficulty,
          coding: question.coding,
          ...feedback
        });

        overallScores.push(feedback.score || 60);

      } catch (error) {
        console.error(`Error generating feedback for question ${question.id}:`, error);
        
        // Use fallback feedback for this question
        const fallbackFeedback = getFallbackFeedback(question, answer);
        feedbackResults.push({
          questionId: question.id,
          questionText: question.text,
          questionType: question.type,
          difficulty: question.difficulty,
          coding: question.coding,
          ...fallbackFeedback
        });
        overallScores.push(60);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate overall statistics
    const averageScore = Math.round(
      overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length
    );

    const strengths = [];
    const improvements = [];
    const strongAreas = [];
    const weakAreas = [];

    feedbackResults.forEach(fb => {
      if (fb.score >= 80) {
        strengths.push(...(fb.strengths || []));
        strongAreas.push(fb.questionType);
      } else if (fb.score < 65) {
        improvements.push(...(fb.improvements || []));
        weakAreas.push(fb.questionType);
      }
    });

    // Remove duplicates and limit
    const uniqueStrengths = [...new Set(strengths)].slice(0, 5);
    const uniqueImprovements = [...new Set(improvements)].slice(0, 5);
    const uniqueStrongAreas = [...new Set(strongAreas)];
    const uniqueWeakAreas = [...new Set(weakAreas)];

    const overallFeedback = {
      overallScore: averageScore,
      totalQuestions: feedbackResults.length,
      answeredQuestions: answers.filter(a => !a.skipped).length,
      skippedQuestions: answers.filter(a => a.skipped).length,
      codingQuestions: feedbackResults.filter(fb => fb.coding).length,
      averageTimePerQuestion: sessionData?.averageTimePerQuestion || 0,
      strengths: uniqueStrengths,
      improvements: uniqueImprovements,
      strongAreas: uniqueStrongAreas,
      weakAreas: uniqueWeakAreas,
      scoreDistribution: {
        excellent: feedbackResults.filter(fb => fb.score >= 90).length,
        good: feedbackResults.filter(fb => fb.score >= 75 && fb.score < 90).length,
        average: feedbackResults.filter(fb => fb.score >= 60 && fb.score < 75).length,
        needsImprovement: feedbackResults.filter(fb => fb.score < 60).length
      },
      detailedFeedback: feedbackResults
    };

    console.log(`Generated feedback for ${feedbackResults.length} questions`);
    console.log(`Overall score: ${averageScore}`);

    res.json({ 
      success: true,
      feedback: overallFeedback,
      generatedAt: new Date().toISOString()
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