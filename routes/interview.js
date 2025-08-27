import express from "express";
import multer from "multer";
import { generateFeedback, getSavedFeedback } from "../controllers/feedbackController.js";
import { upload } from "../middleware/upload.js";
import { generateQuestions, saveSession, getFeedback } from "../controllers/interviewController.js";

export function interviewRoutes(app) {
  // Generate interview questions
  app.post("/api/generate-questions", upload.single("resume"), generateQuestions);

  // Save interview session
  app.post("/api/save-session", saveSession);

  // Get interview feedback (placeholder for future AI analysis)
  app.post("/api/get-feedback", getFeedback);
  // Generate detailed feedback for interview answers
app.post("/api/generate-feedback", generateFeedback);

// Get saved feedback by session ID
app.get("/api/feedback/:sessionId", getSavedFeedback);
}
