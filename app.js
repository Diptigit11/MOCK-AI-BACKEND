import express from "express";
import dotenv from "dotenv";
import { setupMiddleware } from "./middleware/index.js";
import { setupRoutes } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createUploadsDirectory } from "./utils/fileSystem.js";
import { connectDB } from "./config/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Create uploads directory if it doesn't exist
createUploadsDirectory();

// Setup middleware
setupMiddleware(app);

// Setup routes
setupRoutes(app);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", notFoundHandler);

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

  console.log("📁 Upload directory configured");
  console.log("🌐 CORS enabled for frontend origins");
});
