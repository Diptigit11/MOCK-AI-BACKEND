import { generateFeedback } from "../controllers/feedbackController.js";
import { upload } from "../middleware/upload.js";
import { generateQuestions, saveSession, getFeedback } from "../controllers/interviewController.js";

export function interviewRoutes(app) {
  // Generate interview questions
  app.post("/api/generate-questions", upload.single("resume"), generateQuestions);
  
  // Save interview session
  app.post("/api/save-session", saveSession);
  
  // Legacy feedback endpoint (keep for backward compatibility)
  app.post("/api/get-feedback", getFeedback);
  
  // NEW: Generate detailed feedback with transcript analysis
  app.post("/api/generate/feedback", generateFeedback);
  
  // Placeholder for getting saved feedback
  app.get("/api/feedback/:sessionId", (req, res) => {
    res.json({ 
      message: "Saved feedback retrieval - to be implemented",
      sessionId: req.params.sessionId 
    });
  });
  
  // Save feedback
  app.post("/api/feedback/save", (req, res) => {
    const { feedback, sessionId } = req.body;
    console.log("Feedback saved:", { sessionId, timestamp: new Date().toISOString() });
    res.json({ success: true, message: "Feedback saved successfully" });
  });
}