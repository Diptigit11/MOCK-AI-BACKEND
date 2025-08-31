import { healthRoutes } from "./health.js";
import { interviewRoutes } from "./interview.js";
import { resumeRoutes } from "./resume.js"; 
import authRoutes from "./auth.js";

export function setupRoutes(app) {
  // Health check routes
  healthRoutes(app);

  // Interview related routes
  interviewRoutes(app);

  // Resume analyzer routes
  resumeRoutes(app);

  // Auth routes
  app.use("/api/auth", authRoutes);
}
