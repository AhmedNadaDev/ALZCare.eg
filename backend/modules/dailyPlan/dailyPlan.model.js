import mongoose from 'mongoose';

const voicePromptSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Voice prompt text is required'],
    maxlength: [500, 'Voice prompt cannot exceed 500 characters']
  },
  requireResponse: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const responseSchema = new mongoose.Schema({
  text: {
    type: String,
    default: null
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  respondedAt: {
    type: Date,
    default: null
  },
  aiIntent: {
    type: String,
    enum: ['confirm_taken', 'deny_taken', 'forgot', 'feeling_bad', 'confused', null],
    default: null
  },
  aiConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  aiAction: {
    type: String,
    enum: ['mark_completed', 'mark_missed', 'alert_family', 'ask_again', null],
    default: null
  },
  finalAction: {
    type: String,
    enum: ['mark_completed', 'mark_missed', 'alert_family', null],
    default: null
  },
  // ── Decision audit fields ─────────────────────────────────────────────────
  decisionSource: {
    type: String,
    enum: ['rule_engine', 'ai_model', 'hybrid', 'fallback', 'manual', 'timeout', null],
    default: null
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', null],
    default: null
  },
  reasoning: {
    type: String,
    maxlength: 600,
    default: null
  }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  type: {
    type: String,
    enum: ['wake_up', 'medication', 'appointment', 'custom'],
    required: [true, 'Event type is required']
  },
  scheduledTime: {
    type: String,
    required: [true, 'Scheduled time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed'],
    default: 'pending'
  },
  voicePrompt: {
    type: voicePromptSchema,
    required: true
  },
  response: {
    type: responseSchema,
    default: () => ({})
  },
  medicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  }
});

const dailyPlanSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  events: [eventSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    enum: ['Doctor', 'Family'],
    default: 'Family'
  }
}, {
  timestamps: true
});

// Compound index: one plan per patient per day
dailyPlanSchema.index({ patientId: 1, date: 1 }, { unique: true });
dailyPlanSchema.index({ 'events.status': 1, 'events.scheduledTime': 1 });

const DailyPlan = mongoose.model('DailyPlan', dailyPlanSchema);

export default DailyPlan;
