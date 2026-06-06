import mongoose from 'mongoose';

/**
 * Interaction — one atomic patient action inside a session (an answer, a viewed
 * item, a voice reply). Stored inline so a session is fully self-describing.
 */
const interactionSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, default: 'answer' }, // answer | view | voice | skip
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // MemoryItem / Person id
    prompt: { type: String, default: null },
    answer: { type: String, default: null },
    correct: { type: Boolean, default: null },
    responseMs: { type: Number, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/**
 * SessionResult — embedded scoring summary. Belongs to exactly one session,
 * so it is a sub-document rather than a separate collection (avoids an extra
 * join and keeps the result atomic with its session).
 */
const resultSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, default: 0 },
    completionRate: { type: Number, min: 0, max: 100, default: 0 },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    mistakes: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/**
 * CognitiveSession  ("ExerciseSession" + embedded "SessionResult")
 *
 * Every interaction with the cognitive system runs through a session. Tracks
 * the full lifecycle and interaction history.
 *
 * status lifecycle:
 *   scheduled — created by the scheduler, awaiting the patient
 *   active    — patient has started
 *   completed — finished with a result
 *   abandoned — started but not completed (swept after timeout)
 *   missed    — scheduled but never started (swept after timeout)
 */
const cognitiveSessionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CognitiveAssignment',
      default: null,
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CognitiveSchedule',
      default: null,
    },
    kind: {
      type: String,
      enum: ['exercise', 'album'],
      required: [true, 'Session kind is required'],
    },
    exerciseTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExerciseTemplate',
      default: null,
    },
    exerciseType: {
      type: String, // cached from template for analytics grouping
      default: null,
    },
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MemoryAlbum',
      default: null,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'abandoned', 'missed'],
      default: 'active',
    },
    source: {
      type: String,
      enum: ['scheduled', 'manual'],
      default: 'manual',
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
    /**
     * Generated playable payload (exercise rounds / album items + answer keys).
     * Persisted so the patient can resume and so completion can be scored
     * authoritatively against the same content that was presented.
     */
    content: { type: mongoose.Schema.Types.Mixed, default: null },
    // Top-level mirrors of result fields for fast queries / sorting / analytics
    score: { type: Number, min: 0, max: 100, default: null },
    completionRate: { type: Number, min: 0, max: 100, default: null },
    mistakes: { type: Number, default: 0 },
    interactions: [interactionSchema],
    result: { type: resultSchema, default: () => ({}) },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdByModel',
    },
    createdByModel: {
      type: String,
      enum: ['Doctor', 'Family', 'Patient', 'System'],
      default: 'System',
    },
  },
  { timestamps: true }
);

cognitiveSessionSchema.index({ patient: 1, status: 1, startedAt: -1 });
cognitiveSessionSchema.index({ patient: 1, createdAt: -1 });
cognitiveSessionSchema.index({ patient: 1, exerciseType: 1 });
cognitiveSessionSchema.index({ schedule: 1, status: 1 });
cognitiveSessionSchema.index({ status: 1, updatedAt: 1 }); // for the timeout sweeper

const CognitiveSession = mongoose.model('CognitiveSession', cognitiveSessionSchema);

export default CognitiveSession;
