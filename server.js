import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Fix for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enhanced CORS configuration for Vite (port 5173)
app.use(cors({
  origin: [
    "http://localhost:5173", // Vite default port
    "http://127.0.0.1:5173",
    "http://localhost:3000", // Create React App fallback
    "http://127.0.0.1:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true
}));
app.options('*', cors()); // Handle preflight requests

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration
const upload = multer({ 
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fixed PDF parser loading
let pdfParse;
const loadPdfParse = async () => {
  if (!pdfParse) {
    try {
      // Import pdf-parse properly
      const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = pdfModule.default;
    } catch (error) {
      console.warn('PDF parsing not available:', error.message);
      try {
        // Fallback import method
        const pdfModule = await import('pdf-parse');
        pdfParse = pdfModule.default;
      } catch (fallbackError) {
        console.warn('PDF parsing fallback also failed:', fallbackError.message);
        return null;
      }
    }
  }
  return pdfParse;
};

// Fixed mammoth loading
let mammoth;
const loadMammoth = async () => {
  if (!mammoth) {
    try {
      const mammothModule = await import('mammoth');
      mammoth = mammothModule.default;
    } catch (error) {
      console.warn('DOC parsing not available:', error.message);
      return null;
    }
  }
  return mammoth;
};

// Enhanced text extraction with better error handling
async function extractResumeText(filePath, mimetype) {
  try {
    console.log(`Extracting text from: ${filePath}, mimetype: ${mimetype}`);
    
    if (mimetype === "application/pdf") {
      const pdfParser = await loadPdfParse();
      if (!pdfParser) {
        console.warn("PDF parsing not available, skipping resume analysis");
        return "PDF parsing not available - continuing without resume analysis";
      }
      
      if (!fs.existsSync(filePath)) {
        console.error("PDF file not found:", filePath);
        return "PDF file not found";
      }
      
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParser(dataBuffer);
      console.log("PDF text extracted, length:", pdfData.text.length);
      return pdfData.text;
    } 
    else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    ) {
      const docParser = await loadMammoth();
      if (!docParser) {
        console.warn("DOC parsing not available, skipping resume analysis");
        return "DOC parsing not available - continuing without resume analysis";
      }
      
      if (!fs.existsSync(filePath)) {
        console.error("DOC file not found:", filePath);
        return "DOC file not found";
      }
      
      const data = await docParser.extractRawText({ path: filePath });
      console.log("DOC text extracted, length:", data.value.length);
      return data.value;
    } 
    else if (mimetype === "text/plain") {
      if (!fs.existsSync(filePath)) {
        console.error("TXT file not found:", filePath);
        return "TXT file not found";
      }
      
      const text = fs.readFileSync(filePath, "utf-8");
      console.log("TXT text extracted, length:", text.length);
      return text;
    } 
    else {
      return "Unsupported resume format - continuing without resume analysis";
    }
  } catch (error) {
    console.error("Error extracting resume text:", error);
    return `Error extracting resume content: ${error.message} - continuing without resume analysis`;
  }
}

// API Routes

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running", 
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET /api/health",
      "POST /api/generate-questions",
      "POST /api/save-session",
      "POST /api/get-feedback"
    ]
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    gemini: process.env.GEMINI_API_KEY ? "configured" : "missing",
    cors: "enabled",
    uploadDir: uploadsDir
  });
});

// Generate interview questions
app.post("/api/generate-questions", upload.single("resume"), async (req, res) => {
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Create enhanced prompt for question generation
    const prompt = `
You are an expert technical interviewer creating ${questionCount} interview questions for a ${role} position at ${company}.

CONTEXT:
- Role: ${role}
- Company: ${company}
- Interview Type: ${type}
- Difficulty: ${difficulty}
- Duration: ${duration} (${questionCount} questions)
- Include Coding: ${includeCoding}
- Programming Language: ${language}

JOB DESCRIPTION:
${jobDescription}

${resumeText && resumeText.length > 50 ? `CANDIDATE RESUME CONTEXT:\n${resumeText.slice(0, 2000)}` : 'No resume provided - generate general questions for the role.'}

INSTRUCTIONS:
Generate exactly ${questionCount} interview questions in valid JSON format. 

RULES:
1. Questions must be relevant to the ${role} role and job description
2. If includeCoding is "true", include ${Math.ceil(questionCount * 0.3)} coding questions
3. For coding questions: set "coding": true, expectedDuration: 900-2700 seconds
4. For non-coding questions: set "coding": false, expectedDuration: 120-180 seconds
5. Mix question types: technical concepts, problem-solving, experience-based, behavioral
6. Difficulty should match: ${difficulty}
7. Return ONLY valid JSON array, no additional text

Required JSON format:
[
  {
    "id": 1,
    "text": "Question text here",
    "type": "${type}",
    "coding": false,
    "difficulty": "${difficulty}",
    "expectedDuration": 120
  }
]

Generate the questions now:`;

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
      if (!Array.isArray(questions)) {
        throw new Error("Response is not an array");
      }

      // Ensure each question has required fields
      questions = questions.map((q, index) => ({
        id: q.id || index + 1,
        text: q.text || `Generated question ${index + 1}`,
        type: q.type || type,
        coding: includeCoding === "true" ? (q.coding || false) : false,
        difficulty: q.difficulty || difficulty,
        expectedDuration: q.expectedDuration || (q.coding ? 900 : 180)
      }));

      // Ensure we have the right number of questions
      if (questions.length > questionCount) {
        questions = questions.slice(0, questionCount);
      } else if (questions.length < questionCount) {
        // Add fallback questions if needed
        const needed = questionCount - questions.length;
        for (let i = 0; i < needed; i++) {
          questions.push({
            id: questions.length + 1,
            text: `What experience do you have with ${role.toLowerCase()} responsibilities?`,
            type: type,
            coding: false,
            difficulty: difficulty,
            expectedDuration: 180
          });
        }
      }

    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.log("Raw response:", responseText);
      
      // Enhanced fallback questions based on role and type
      const getFallbackQuestions = () => {
        const baseQuestions = [
          { text: `Tell me about your experience as a ${role}.`, type: "behavioral" },
          { text: `What interests you about working at ${company}?`, type: "behavioral" },
          { text: `Describe a challenging project you've worked on.`, type: "behavioral" },
          { text: `How do you stay updated with industry trends?`, type: "technical" },
          { text: `Where do you see yourself in 5 years?`, type: "hr" }
        ];

        // Add role-specific questions
        if (role.toLowerCase().includes('frontend') || role.toLowerCase().includes('react')) {
          baseQuestions.push(
            { text: "What are the key differences between React class components and functional components?", type: "technical" },
            { text: "How do you optimize React application performance?", type: "technical" },
            { text: "Explain the virtual DOM and how React uses it.", type: "technical" }
          );
        }

        if (includeCoding === "true") {
          baseQuestions.push(
            { text: `Write a function to reverse a string in ${language}.`, type: "technical", coding: true },
            { text: `Implement a function to check if a string is a palindrome.`, type: "technical", coding: true }
          );
        }

        return baseQuestions.slice(0, questionCount).map((q, index) => ({
          id: index + 1,
          text: q.text,
          type: q.type,
          coding: q.coding || false,
          difficulty,
          expectedDuration: q.coding ? 900 : 180
        }));
      };

      questions = getFallbackQuestions();
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
});

// Save interview session
app.post("/api/save-session", (req, res) => {
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
});

// Get interview feedback (placeholder for future AI analysis)
app.post("/api/get-feedback", (req, res) => {
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
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
  }
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error", details: error.message });
});

// 404 handler
app.use("*", (req, res) => {
  console.log("404 - Route not found:", req.originalUrl);
  res.status(404).json({ 
    error: "Route not found",
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  
  // Check for required environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY not found in environment variables");
    console.warn("   Please add your Gemini API key to the .env file");
  } else {
    console.log("✅ Gemini API key configured");
  }

  console.log("📁 Upload directory:", uploadsDir);
  console.log("🌐 CORS enabled for frontend origins");
});