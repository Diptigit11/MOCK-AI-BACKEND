import { initializeGemini } from "./geminiService.js";

export async function analyzeResumeWithGemini(resumeText, jobDescription) {
  try {
    const model = initializeGemini();

    const prompt = `
You are an experienced recruiter and ATS (Applicant Tracking System) Resume Analyzer.  
Your task is to evaluate the following resume against the job description.  

Resume: 
${resumeText}

Job Description:
${jobDescription}

Return a **valid JSON object only** with the following fields (strict JSON, no extra text, no code block):

{
  "ats_friendly": "Yes/No with explanation",
  "fit_for_role": "Strong / Moderate / Weak (with reasoning)",
  "missing_keywords": ["list", "of", "missing", "skills"],
  "improvements": ["list of suggestions for resume improvement"],
  "clarity": "Readable / Needs better formatting / Poor",
  "achievements": "Yes/No (with explanation)",
  "sections": {
    "summary": true/false,
    "skills": true/false,
    "experience": true/false,
    "education": true/false,
    "projects": true/false
  },
  "red_flags": ["list of issues in the resume"],
  "formatting": "Good / Inconsistent / Overloaded",
  "resume_length": "1 page / 2 pages / Too long",
  "soft_skills": ["list of soft skills found"],
  "score": number (0-100)
}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // 🛠️ Remove unwanted markdown formatting if Gemini adds ```json ... ```
    text = text.replace(/```json|```/g, "").trim();

    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn("Parsing failed, returning raw response");
      return { raw: text };
    }
  } catch (error) {
    console.error("Error analyzing resume with Gemini:", error);
    return { error: error.message };
  }
}
