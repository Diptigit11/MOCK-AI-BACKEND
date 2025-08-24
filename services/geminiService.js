import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;

export function initializeGemini() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}