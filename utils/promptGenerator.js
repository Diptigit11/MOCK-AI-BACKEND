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
// Add this function to your existing promptGenerator.js file

export function generateFeedbackPrompt(options) {
  const { question, answer, sessionData } = options;
  
  const hasAudio = answer.audioURL && !answer.skipped;
  const hasCode = answer.code && !answer.skipped;
  const isSkipped = answer.skipped;
  
  return `
You are an expert technical interview assessor. Analyze this interview question and candidate's response to provide detailed, constructive feedback.

QUESTION DETAILS:
- ID: ${question.id}
- Type: ${question.type}
- Difficulty: ${question.difficulty}
- Coding Question: ${question.coding}
- Question: "${question.text}"
${question.expectedDuration ? `- Expected Duration: ${question.expectedDuration} seconds` : ''}

CANDIDATE RESPONSE:
${isSkipped ? 
  'RESPONSE: Question was skipped by candidate' :
  question.coding ? 
    `CODE SUBMITTED: ${hasCode ? `\n\`\`\`\n${answer.code}\n\`\`\`` : 'No code submitted'}` :
    `AUDIO RESPONSE: ${hasAudio ? 'Audio response recorded' : 'No audio response recorded'}`
}

${answer.recordedAt ? `Response Time: ${answer.recordedAt}` : ''}
${answer.submittedAt ? `Submission Time: ${answer.submittedAt}` : ''}

INTERVIEW CONTEXT:
- Role: ${sessionData.role || 'Not specified'}
- Company: ${sessionData.company || 'Not specified'}
- Interview Type: ${sessionData.type || 'Not specified'}

ASSESSMENT CRITERIA:
For Technical Questions:
- Technical accuracy and depth of knowledge
- Problem-solving approach
- Code quality (if applicable)
- Understanding of concepts
- Communication clarity

For Behavioral Questions:
- Relevance of examples
- Communication skills
- Leadership/teamwork demonstration
- Problem-solving mindset

For Coding Questions:
- Algorithm correctness
- Code efficiency and optimization
- Code readability and structure
- Edge case handling
- Time and space complexity awareness

SCORING GUIDE:
- 90-100: Excellent - Comprehensive, accurate, well-articulated
- 75-89: Good - Solid understanding with minor gaps
- 60-74: Average - Basic understanding, needs improvement
- 40-59: Below Average - Significant gaps in knowledge/approach
- 0-39: Poor - Incorrect or no meaningful response

INSTRUCTIONS:
Provide feedback in the following JSON format. Be specific, constructive, and actionable:

{
  "score": 85,
  "assessment": "Detailed assessment of the response quality and accuracy",
  "strengths": [
    "Specific strength 1",
    "Specific strength 2"
  ],
  "improvements": [
    "Specific area for improvement 1",
    "Specific area for improvement 2"
  ],
  "suggestions": [
    "Actionable suggestion 1",
    "Actionable suggestion 2"
  ],
  "keywordsCovered": [
    "technical term 1",
    "concept 2"
  ],
  "missedOpportunities": [
    "What could have been mentioned",
    "Additional concepts to explore"
  ]
}

${isSkipped ? 
  'NOTE: Since this question was skipped, focus on what the candidate missed and what they should study.' :
  question.coding && !hasCode ?
    'NOTE: Since no code was submitted, provide feedback on what was expected and how to approach this problem.' :
    !question.coding && !hasAudio ?
      'NOTE: Since no response was recorded, provide feedback on what should have been covered.' :
      'NOTE: Provide comprehensive feedback based on the response quality.'
}

Analyze and provide feedback now:`;
}