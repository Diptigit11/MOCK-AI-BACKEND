// models/feedbackModels.js - Updated to match your existing structure
import mongoose from "mongoose";

// Existing Feedback Schema (matches your current DB structure)
const existingFeedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  company: {
    type: String
  },
  interviewType: {
    type: String,
    default: 'technical'
  },
  difficulty: {
    type: String,
    default: 'medium'
  },
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  answeredQuestions: {
    type: Number,
    required: true
  },
  skippedQuestions: {
    type: Number,
    default: 0
  },
  codingQuestions: {
    type: Number,
    default: 0
  },
  averageTimePerQuestion: {
    type: Number,
    default: 0
  },
  totalInterviewTime: {
    type: Number,
    default: 0
  },
  strengths: [{
    type: String
  }],
  improvements: [{
    type: String
  }],
  strongAreas: [{
    type: String
  }],
  weakAreas: [{
    type: String
  }],
  scoreDistribution: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  detailedFeedback: [{
    questionId: String,
    questionText: String,
    userAnswer: String,
    score: Number,
    feedback: String,
    strengths: [String],
    improvements: [String]
  }],
  resumeProcessed: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'javascript'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'feedback' // Use your existing collection name
});

// Enhanced Feedback Schema (for new detailed feedback)
const enhancedFeedbackSchema = new mongoose.Schema({
  // Keep existing fields for backward compatibility
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  company: {
    type: String
  },
  interviewType: {
    type: String,
    default: 'technical'
  },
  difficulty: {
    type: String,
    default: 'medium'
  },
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  answeredQuestions: {
    type: Number,
    required: true
  },
  skippedQuestions: {
    type: Number,
    default: 0
  },
  codingQuestions: {
    type: Number,
    default: 0
  },
  averageTimePerQuestion: {
    type: Number,
    default: 0
  },
  totalInterviewTime: {
    type: Number,
    default: 0
  },
  strengths: [{
    type: String
  }],
  improvements: [{
    type: String
  }],
  strongAreas: [{
    type: String
  }],
  weakAreas: [{
    type: String
  }],
  scoreDistribution: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  detailedFeedback: [{
    questionId: String,
    questionText: String,
    userAnswer: String,
    score: Number,
    feedback: String,
    strengths: [String],
    improvements: [String]
  }],
  resumeProcessed: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'javascript'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  
  // NEW ENHANCED FIELDS (optional for backward compatibility)
  overallGrade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F']
  },
  completionRate: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Enhanced metrics (optional)
  enhancedMetrics: {
    averageCommunicationScore: Number,
    averageTechnicalScore: Number,
    totalWordsSpoken: Number,
    averageWordsPerResponse: Number,
    questionsWithTranscripts: Number
  },
  
  // Enhanced feedback arrays
  overallStrengths: [{
    type: String
  }],
  overallImprovements: [{
    type: String
  }],
  recommendations: [{
    type: String
  }],
  nextSteps: [{
    type: String
  }],
  
  // Enhanced question feedbacks (optional)
  questionFeedbacks: [{
    questionId: String,
    questionText: String,
    questionType: String,
    difficulty: String,
    coding: Boolean,
    score: Number,
    wasAnswered: Boolean,
    hasTranscript: Boolean,
    transcription: {
      text: String,
      confidence: Number,
      audioDuration: Number,
      language: String
    },
    transcriptWordCount: Number,
    detailedFeedback: String,
    strengths: [String],
    improvements: [String],
    communicationScore: Number,
    technicalScore: Number,
    completeness: Number,
    clarity: Number
  }],
  
  // Category performance
  categoryPerformance: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Communication analysis
  communicationAnalysis: {
    totalWordsSpoken: Number,
    averageWordsPerResponse: Number,
    communicationPatterns: {
      brevity: {
        type: String,
        enum: ['concise', 'balanced', 'detailed']
      },
      technicalLanguageUse: {
        type: String,
        enum: ['low', 'moderate', 'high']
      }
    }
  },
  
  // Interview metadata
  interviewMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Version field to distinguish old vs new feedback
  feedbackVersion: {
    type: String,
    enum: ['v1', 'v2'],
    default: 'v1'
  }
}, {
  timestamps: true,
  collection: 'feedback'
});

// Indexes
enhancedFeedbackSchema.index({ userId: 1 });
enhancedFeedbackSchema.index({ sessionId: 1 });
enhancedFeedbackSchema.index({ userId: 1, generatedAt: -1 });
enhancedFeedbackSchema.index({ overallScore: -1 });
enhancedFeedbackSchema.index({ feedbackVersion: 1 });

const Feedback = mongoose.model('Feedback', enhancedFeedbackSchema);

// Sessions and Questions schemas (unchanged)
const sessionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobRole: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'sessions'
});

const questionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'general'
  },
  difficulty: {
    type: String,
    default: 'medium'
  },
  coding: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'questions'
});

const Session = mongoose.model('Session', sessionSchema);
const Question = mongoose.model('Question', questionSchema);

export { Session, Question, Feedback };

// Migration script to update existing feedback documents
// utils/migrateFeedback.js
export async function migrateFeedbackToV2() {
  try {
    // Find all v1 feedback (existing format)
    const v1Feedbacks = await Feedback.find({ 
      $or: [
        { feedbackVersion: { $exists: false } },
        { feedbackVersion: 'v1' }
      ]
    });

    console.log(`Found ${v1Feedbacks.length} v1 feedback documents to migrate`);

    for (const feedback of v1Feedbacks) {
      // Transform v1 to v2 format while keeping existing data
      const updateData = {
        // Keep all existing fields
        ...feedback.toObject(),
        
        // Add new v2 fields
        overallGrade: calculateGrade(feedback.overallScore),
        completionRate: Math.round((feedback.answeredQuestions / feedback.totalQuestions) * 100),
        
        enhancedMetrics: {
          averageCommunicationScore: feedback.overallScore,
          averageTechnicalScore: null,
          totalWordsSpoken: 0,
          averageWordsPerResponse: 0,
          questionsWithTranscripts: 0
        },
        
        overallStrengths: feedback.strengths || [],
        overallImprovements: feedback.improvements || [],
        recommendations: generateRecommendationsFromScore(feedback.overallScore),
        nextSteps: generateNextStepsFromScore(feedback.overallScore),
        
        // Transform existing detailedFeedback to new questionFeedbacks format
        questionFeedbacks: feedback.detailedFeedback?.map(detail => ({
          questionId: detail.questionId,
          questionText: detail.questionText,
          questionType: 'technical',
          difficulty: feedback.difficulty,
          coding: false,
          score: detail.score || feedback.overallScore,
          wasAnswered: true,
          hasTranscript: false,
          transcription: null,
          transcriptWordCount: 0,
          detailedFeedback: detail.feedback || '',
          strengths: detail.strengths || [],
          improvements: detail.improvements || [],
          communicationScore: detail.score || feedback.overallScore,
          technicalScore: null,
          completeness: detail.score || feedback.overallScore,
          clarity: null
        })) || [],
        
        feedbackVersion: 'v2'
      };

      await Feedback.findByIdAndUpdate(feedback._id, updateData);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

function calculateGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  return 'D';
}

function generateRecommendationsFromScore(score) {
  if (score < 60) {
    return ['Focus on understanding fundamental concepts', 'Practice explaining your thought process'];
  } else if (score < 75) {
    return ['Work on providing more comprehensive answers', 'Practice technical interview questions'];
  } else {
    return ['Maintain your strong performance', 'Focus on advanced scenarios'];
  }
}

function generateNextStepsFromScore(score) {
  return [
    'Review the detailed feedback for each question',
    'Practice the areas identified for improvement',
    'Take another mock interview to track progress'
  ];
}