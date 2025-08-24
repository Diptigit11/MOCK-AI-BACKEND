import fs from "fs";
import { initializeGemini } from "../services/geminiService.js";
import { extractResumeText } from "../services/resumeService.js";
import { generateQuestionsPrompt } from "../utils/promptGenerator.js";
import { getFallbackQuestions, validateAndFixQuestions } from "../utils/questionUtils.js";

// Generate interview questions
export async function generateQuestions(req, res) {
  console.log("=== Generate Questions Request ===");
  console.log("Body:", req.body);
  console.log("File:", req.file ? req.file.originalname : "No file");

  try {
    const { 
      role, 
      company = "General Company",
      jobDescription, 
      difficulty = "medium", 
      type = "technical", 
      includeCoding = "false", 
      language = "javascript",
      duration = "medium" 
    } = req.body;

    // Validation
    if (!role || !jobDescription) {
      return res.status(400).json({ 
        error: "Missing required fields: role and jobDescription are required" 
      });
    }

    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key not configured. Please add GEMINI_API_KEY to your .env file" 
      });
    }

    let resumeText = "";

    // Extract resume text if file uploaded
    if (req.file) {
      try {
        console.log("Processing resume file:", req.file.originalname, "at path:", req.file.path);
        resumeText = await extractResumeText(req.file.path, req.file.mimetype);
        console.log("Resume text extracted, length:", resumeText.length);
        
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (error) {
        console.error("Error processing resume:", error);
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        // Continue without resume instead of failing
        resumeText = "Resume processing failed - continuing without resume analysis";
      }
    }

    // Determine number of questions based on duration
    const questionCounts = { short: 5, medium: 10, long: 15 };
    const questionCount = questionCounts[duration] || 10;

    // Initialize Gemini model
    const model = initializeGemini();

    // Create enhanced prompt for question generation
    const prompt = generateQuestionsPrompt({
      role,
      company,
      jobDescription,
      resumeText,
      type,
      difficulty,
      duration,
      includeCoding,
      language,
      questionCount
    });

    console.log("Calling Gemini API...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("Gemini response received, length:", responseText.length);

    let questions;
    try {
      // Clean the response to extract JSON
      const cleanResponse = responseText
        .replace(/```json\n?|\n?```/g, '')
        .replace(/```\n?|\n?```/g, '')
        .trim();
      
      console.log("Cleaned response:", cleanResponse.substring(0, 200) + "...");
      questions = JSON.parse(cleanResponse);

      // Validate and fix the questions structure
      questions = validateAndFixQuestions(questions, {
        type,
        difficulty,
        includeCoding,
        questionCount
      });

    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.log("Raw response:", responseText);
      
      // Use fallback questions
      questions = getFallbackQuestions({
        role,
        company,
        type,
        difficulty,
        includeCoding,
        language,
        questionCount
      });
    }

    console.log("Generated questions:", questions.length);

    res.json({ 
      questions,
      metadata: {
        role,
        company,
        type,
        difficulty,
        duration,
        includeCoding: includeCoding === "true",
        language,
        totalQuestions: questions.length,
        codingQuestions: questions.filter(q => q.coding).length,
        resumeProcessed: !!req.file
      }
    });

  } catch (error) {
    console.error("Generate Questions Error:", error);
    res.status(500).json({ 
      error: "Failed to generate questions", 
      details: error.message,
      suggestion: "Please check your Gemini API key and try again"
    });
  }
}

// Save interview session
export function saveSession(req, res) {
  try {
    const { sessionData, answers } = req.body;
    
    // Here you would typically save to a database
    // For now, we'll just acknowledge receipt
    console.log("Session saved:", { 
      sessionId: `session_${Date.now()}`,
      questionsCount: sessionData?.questions?.length || 0,
      answersCount: answers?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: "Interview session saved successfully",
      sessionId: `session_${Date.now()}`
    });
  } catch (error) {
    console.error("Error saving session:", error);
    res.status(500).json({ error: "Failed to save session" });
  }
}

// Get interview feedback (placeholder for future AI analysis)
export function getFeedback(req, res) {
  try {
    const { answers, questions } = req.body;
    
    // Placeholder for AI-powered feedback analysis
    const feedback = {
      overallScore: Math.floor(Math.random() * 20) + 70, // 70-90
      strengths: ["Good technical knowledge", "Clear communication"],
      improvements: ["Practice coding problems", "Provide more specific examples"],
      questionScores: questions.map((q, index) => ({
        questionId: q.id,
        score: Math.floor(Math.random() * 40) + 60, // Random score 60-100
        feedback: "Good answer with room for improvement"
      }))
    };

    res.json({ feedback });
  } catch (error) {
    console.error("Error generating feedback:", error);
    res.status(500).json({ error: "Failed to generate feedback" });
  }
}