import { getUploadsDir } from "../utils/fileSystem.js";

export function healthRoutes(app) {
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
      uploadDir: getUploadsDir()
    });
  });
}