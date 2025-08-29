import { healthRoutes } from "./health.js";
import { interviewRoutes } from "./interview.js";
import { resumeRoutes } from "./resume.js"; // new import

export function setupRoutes(app) {
  // Health check routes
  healthRoutes(app);

  // Interview related routes
  interviewRoutes(app);

  // Resume analyzer routes
  resumeRoutes(app);
}
