import { extractResumeText } from "../services/resumeService.js";
import { analyzeResumeWithGemini } from "../services/geminiResumeAnalyzer.js";

export async function analyzeResume(req, res) {
  try {
    const jobDescription = req.body.jobDescription;
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" });
    }

    const filePath = req.file.path;
    const mimetype = req.file.mimetype;

    // 1. Resume text extract
    const resumeText = await extractResumeText(filePath, mimetype);

    // 2. Gemini se analysis
    const feedback = await analyzeResumeWithGemini(resumeText, jobDescription);

    res.json({ feedback });
  } catch (error) {
    console.error("Error analyzing resume:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
