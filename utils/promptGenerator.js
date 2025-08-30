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

export function generateFeedbackPrompt(options) {
  const { question, answer, sessionData } = options;
  
  const hasAudio = answer.audioURL && !answer.skipped;
  const hasCode = answer.code && !answer.skipped;
  const isSkipped = answer.skipped;
  
  // Parse transcript data if available
  let transcriptText = '';
  let transcriptConfidence = 0;
  
  if (answer.transcription) {
    if (typeof answer.transcription === 'string') {
      try {
        const parsed = JSON.parse(answer.transcription);
        transcriptText = parsed.transcript || '';
        transcriptConfidence = parsed.confidence || 0;
      } catch (e) {
        transcriptText = answer.transcription;
      }
    } else if (typeof answer.transcription === 'object') {
      transcriptText = answer.transcription.transcript || answer.transcription.text || '';
      transcriptConfidence = answer.transcription.confidence || 0;
    }
  }

  const hasTranscript = transcriptText.trim().length > 0;

  return `You are an expert technical interview assessor. Analyze this interview question and candidate's response to provide detailed, constructive feedback.

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
    hasTranscript ? 
      `SPOKEN RESPONSE (Transcribed): "${transcriptText}"
      
Speech Recognition Confidence: ${Math.round(transcriptConfidence * 100)}%
Word Count: ${transcriptText.split(/\s+/).filter(word => word.length > 0).length}` :
      hasAudio ? 
        'Audio response recorded but transcription not available' :
        'No response recorded'
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
- Problem-solving approach and methodology
- Code quality and best practices (if applicable)
- Understanding of fundamental concepts
- Communication clarity and structure
- Use of appropriate technical terminology

For Behavioral Questions:
- Relevance and specificity of examples
- Communication skills and articulation
- Leadership/teamwork demonstration
- Problem-solving mindset and approach
- Self-awareness and learning ability

For Coding Questions:
- Algorithm correctness and logic
- Code efficiency and optimization
- Code readability and structure
- Edge case handling and testing approach
- Time and space complexity awareness
- Explanation of thought process

COMMUNICATION ASSESSMENT:
${hasTranscript ? `
Analyze the candidate's communication based on their spoken response:
- Clarity of explanation
- Logical flow of ideas
- Use of technical terminology
- Completeness of answer
- Confidence in delivery (inferred from content)
` : ''}

SCORING GUIDE:
- 90-100: Excellent - Comprehensive, accurate, well-articulated response
- 80-89: Good - Solid understanding with minor gaps or communication issues
- 70-79: Above Average - Good grasp but lacks depth or has some inaccuracies
- 60-69: Average - Basic understanding, needs improvement in depth/accuracy
- 50-59: Below Average - Significant gaps in knowledge or poor communication
- 0-49: Poor - Incorrect, incomplete, or no meaningful response

INSTRUCTIONS:
Provide feedback in the following JSON format. Be specific, constructive, and actionable. Base your assessment on the actual content provided:

{
  "score": 85,
  "assessment": "Detailed assessment of the response quality, technical accuracy, and communication effectiveness",
  "strengths": [
    "Specific strength based on actual response content",
    "Communication or technical strength observed"
  ],
  "improvements": [
    "Specific area for improvement with actionable advice",
    "Communication or technical gap identified"
  ],
  "suggestions": [
    "Actionable suggestion for improvement",
    "Specific study or practice recommendation"
  ],
  "keywordsCovered": [
    "technical terms or concepts mentioned correctly",
    "relevant terminology used"
  ],
  "missedOpportunities": [
    "Important concepts that should have been mentioned",
    "Additional points that would strengthen the answer"
  ],
  "communicationScore": 80,
  "technicalScore": ${question.coding || question.type === 'technical' ? '85' : 'null'},
  "completeness": 75,
  "clarity": 80
}

${isSkipped ? 
  'NOTE: Since this question was skipped, focus on what the candidate missed and provide study recommendations for this topic.' :
  question.coding && !hasCode ?
    'NOTE: Since no code was submitted, provide feedback on the expected approach and solution strategy.' :
    !question.coding && !hasTranscript && !hasAudio ?
      'NOTE: Since no response was recorded, provide feedback on what should have been covered and how to approach this question.' :
      hasTranscript ?
        'NOTE: Provide comprehensive feedback based on the transcribed response. Analyze both technical content and communication effectiveness.' :
        hasAudio ?
          'NOTE: Audio was recorded but transcription is not available. Provide general guidance on what should be covered for this question.' :
          'NOTE: Provide feedback based on available response data.'
}

${hasTranscript ? `
IMPORTANT: Base your assessment primarily on the actual transcribed content: "${transcriptText}"

Analyze this response for:
1. Technical accuracy and completeness
2. Communication clarity and structure  
3. Use of appropriate examples or explanations
4. Depth of understanding demonstrated
5. Areas where the response could be improved

Provide specific feedback that references the actual content of their response.
` : ''}

Analyze and provide feedback now:`;
}

// Helper function to extract transcript text from various formats
export function extractTranscriptText(transcriptionData) {
  if (!transcriptionData) return '';
  
  if (typeof transcriptionData === 'string') {
    try {
      const parsed = JSON.parse(transcriptionData);
      return parsed.transcript || parsed.text || '';
    } catch (e) {
      return transcriptionData;
    }
  }
  
  if (typeof transcriptionData === 'object') {
    return transcriptionData.transcript || transcriptionData.text || '';
  }
  
  return '';
}

// Helper function to get word count from transcript
export function getTranscriptWordCount(transcriptionData) {
  const text = extractTranscriptText(transcriptionData);
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

// Helper function to get transcript confidence
export function getTranscriptConfidence(transcriptionData) {
  if (!transcriptionData) return 0;
  
  if (typeof transcriptionData === 'string') {
    try {
      const parsed = JSON.parse(transcriptionData);
      return parsed.confidence || 0;
    } catch (e) {
      return 0;
    }
  }
  
  if (typeof transcriptionData === 'object') {
    return transcriptionData.confidence || 0;
  }
  
  return 0;
}