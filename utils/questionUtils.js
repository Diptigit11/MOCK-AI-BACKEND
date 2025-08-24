export function validateAndFixQuestions(questions, options) {
  const { type, difficulty, includeCoding, questionCount } = options;

  if (!Array.isArray(questions)) {
    throw new Error("Response is not an array");
  }

  // Ensure each question has required fields
  questions = questions.map((q, index) => ({
    id: q.id || index + 1,
    text: q.text || `Generated question ${index + 1}`,
    type: q.type || type,
    coding: includeCoding === "true" ? (q.coding || false) : false,
    difficulty: q.difficulty || difficulty,
    expectedDuration: q.expectedDuration || (q.coding ? 900 : 180)
  }));

  // Ensure we have the right number of questions
  if (questions.length > questionCount) {
    questions = questions.slice(0, questionCount);
  } else if (questions.length < questionCount) {
    // Add fallback questions if needed
    const needed = questionCount - questions.length;
    for (let i = 0; i < needed; i++) {
      questions.push({
        id: questions.length + 1,
        text: `What experience do you have with ${type.toLowerCase()} responsibilities?`,
        type: type,
        coding: false,
        difficulty: difficulty,
        expectedDuration: 180
      });
    }
  }

  return questions;
}

export function getFallbackQuestions(options) {
  const { role, company, type, difficulty, includeCoding, language, questionCount } = options;

  const baseQuestions = [
    { text: `Tell me about your experience as a ${role}.`, type: "behavioral" },
    { text: `What interests you about working at ${company}?`, type: "behavioral" },
    { text: `Describe a challenging project you've worked on.`, type: "behavioral" },
    { text: `How do you stay updated with industry trends?`, type: "technical" },
    { text: `Where do you see yourself in 5 years?`, type: "hr" }
  ];

  // Add role-specific questions
  if (role.toLowerCase().includes('frontend') || role.toLowerCase().includes('react')) {
    baseQuestions.push(
      { text: "What are the key differences between React class components and functional components?", type: "technical" },
      { text: "How do you optimize React application performance?", type: "technical" },
      { text: "Explain the virtual DOM and how React uses it.", type: "technical" }
    );
  }

  if (includeCoding === "true") {
    baseQuestions.push(
      { text: `Write a function to reverse a string in ${language}.`, type: "technical", coding: true },
      { text: `Implement a function to check if a string is a palindrome.`, type: "technical", coding: true }
    );
  }

  return baseQuestions.slice(0, questionCount).map((q, index) => ({
    id: index + 1,
    text: q.text,
    type: q.type,
    coding: q.coding || false,
    difficulty,
    expectedDuration: q.coding ? 900 : 180
  }));
}