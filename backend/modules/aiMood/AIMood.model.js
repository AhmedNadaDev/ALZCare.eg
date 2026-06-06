/**
 * AIMood.model.js
 *
 * Stores the result of each AI-driven voice emotion check-in.
 * This is separate from the legacy caregiver-entered Mood model so we can
 * evolve the two schemas independently and keep historical manual records.
 */

import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const EMOTION_LABELS = [
  'neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise', 'bored',
];

// Emotions the clinical team considers worth flagging
const ALERT_EMOTIONS = new Set(['sad', 'angry', 'fear', 'disgust']);

const aiMoodSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },

    emotion: {
      type: String,
      enum: EMOTION_LABELS,
      required: true,
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },

    /** Raw probability scores from the model — optional, useful for debugging */
    allScores: {
      type: Map,
      of: Number,
      default: undefined,
    },

    /** Scheduled HH:MM that triggered this check-in */
    scheduledTime: {
      type: String,
      default: null,
    },

    /** When the socket event was emitted to the patient */
    triggeredAt: {
      type: Date,
      default: Date.now,
    },

    /** Source tag — always 'voice_ai_checkin' for automated check-ins */
    source: {
      type: String,
      default: 'voice_ai_checkin',
    },

    isAbnormal: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'recordedAt', updatedAt: false },
  }
);

// Pre-save: auto-flag concerning emotions
aiMoodSchema.pre('save', function (next) {
  this.isAbnormal = ALERT_EMOTIONS.has(this.emotion) || this.confidence < 0.35;
  next();
});

// Compound index: fast patient timeline queries
aiMoodSchema.index({ patientId: 1, recordedAt: -1 });

// Static helpers mirror the legacy Mood model API for a smooth frontend migration
aiMoodSchema.statics.getHistory = function (patientId, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  return this.find({ patientId, recordedAt: { $gte: since } })
    .sort({ recordedAt: -1 });
};

aiMoodSchema.statics.getLatest = function (patientId) {
  return this.findOne({ patientId }).sort({ recordedAt: -1 });
};

aiMoodSchema.statics.getStats = function (patientId, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  return this.aggregate([
    { $match: { patientId: new mongoose.Types.ObjectId(patientId), recordedAt: { $gte: since } } },
    {
      $group: {
        _id: '$emotion',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

export default model('AIMood', aiMoodSchema);
