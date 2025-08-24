import { genAI } from "../config/gemini.js";

export async function generateInterviewQuestions({ role, company, jobDescription, difficulty, type, includeCoding, language, duration, resumeText }) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
Generate interview questions for a ${role} at ${company}.
Job Description: ${jobDescription}
Resume: ${resumeText || "No resume"}
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().replace(/```json|```/g, ""));
}
