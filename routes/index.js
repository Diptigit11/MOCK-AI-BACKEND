import { healthRoutes } from "./health.js";
import { interviewRoutes } from "./interview.js";

export function setupRoutes(app) {
  // Health check routes
  healthRoutes(app);
  
  // Interview related routes
  interviewRoutes(app);
}