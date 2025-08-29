import { upload } from "../middleware/upload.js";
import { analyzeResume } from "../controllers/resumeController.js";

export function resumeRoutes(app) {
  // Resume analyzer endpoint
  app.post("/api/analyze-resume", upload.single("resume"), analyzeResume);
}
