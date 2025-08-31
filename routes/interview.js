import { 
  generateFeedback, 
  getFeedbackByUserId, 
  getFeedbackBySessionId,
  getFeedbackAnalyticsByUserId   // ✅ new controller
} from "../controllers/feedbackController.js";

import { upload } from "../middleware/upload.js";
import { generateQuestions, saveSession, getFeedback } from "../controllers/interviewController.js";
import { protect } from "../middleware/authMiddleware.js"; 

export function interviewRoutes(app) {
  // Generate interview questions
  app.post("/api/generate-questions", upload.single("resume"), generateQuestions);
  
  // Save interview session
  app.post("/api/save-session", protect, saveSession);
  
  // Legacy feedback endpoint (keep for backward compatibility)
  app.post("/api/get-feedback", protect, getFeedback);
  
  // NEW: Generate detailed feedback with transcript analysis
  app.post("/api/generate/feedback", protect, generateFeedback);
  
  // NEW: Get feedback by user ID (paginated list)
  app.get("/api/feedback/user/:userId", protect, getFeedbackByUserId);
  
  // ✅ NEW: Get feedback analytics by user ID (for profile dashboard)
  app.get("/api/feedback/user/:userId/analytics", protect, getFeedbackAnalyticsByUserId);
  
  // NEW: Get feedback by session ID
  app.get("/api/feedback/session/:sessionId", protect, getFeedbackBySessionId);
}



