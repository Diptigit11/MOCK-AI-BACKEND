export function generateQuestionsPrompt(options) {
  const {
    role,
    company,
    jobDescription,
    resumeText,
    type,
    difficulty,
    duration,
    includeCoding,
    language,
    questionCount
  } = options;

  return `
You are an expert technical interviewer creating ${questionCount} interview questions for a ${role} position at ${company}.

CONTEXT:
- Role: ${role}
- Company: ${company}
- Interview Type: ${type}
- Difficulty: ${difficulty}
- Duration: ${duration} (${questionCount} questions)
- Include Coding: ${includeCoding}
- Programming Language: ${language}

JOB DESCRIPTION:
${jobDescription}

${resumeText && resumeText.length > 50 ? `CANDIDATE RESUME CONTEXT:\n${resumeText.slice(0, 2000)}` : 'No resume provided - generate general questions for the role.'}

INSTRUCTIONS:
Generate exactly ${questionCount} interview questions in valid JSON format. 

RULES:
1. Questions must be relevant to the ${role} role and job description
2. If includeCoding is "true", include ${Math.ceil(questionCount * 0.3)} coding questions
3. For coding questions: set "coding": true, expectedDuration: 900-2700 seconds
4. For non-coding questions: set "coding": false, expectedDuration: 120-180 seconds
5. Mix question types: technical concepts, problem-solving, experience-based, behavioral
6. Difficulty should match: ${difficulty}
7. Return ONLY valid JSON array, no additional text

Required JSON format:
[
  {
    "id": 1,
    "text": "Question text here",
    "type": "${type}",
    "coding": false,
    "difficulty": "${difficulty}",
    "expectedDuration": 120
  }
]

Generate the questions now:`;
}