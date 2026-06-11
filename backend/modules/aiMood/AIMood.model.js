/**
 * AIMood.model.js
 *
 * Stores the result of each AI-driven voice mood check-in produced by the
 * WavLM multi-task model (backend/mood_service).
 *
 * The model returns TWO outputs per clip:
 *   • mood    — one of six clinical mood states (fine-grained, softer signal)
 *   • arousal — low / high (the more reliable, clinically meaningful signal)
 *
 * Outputs are probabilistic estimates of *acoustic* mood/arousal — not diagnoses.
 */

import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Six-class clinical mood taxonomy (matches label_mapping.json / the model head).
export const MOOD_STATES = ['Calm', 'Neutral', 'Content', 'Anxious', 'Agitated', 'Low'];

// Coarse arousal axis.
export const AROUSAL_STATES = ['low', 'high'];

// Negative / concerning mood states worth flagging for a caregiver.
export const ALERT_MOODS = new Set(['Anxious', 'Agitated', 'Low']);

const topkSchema = new Schema(
  { mood: { type: String, enum: MOOD_STATES }, prob: { type: Number, min: 0, max: 1 } },
  { _id: false }
);

const aiMoodSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },

    // ── Mood head ──
    mood: { type: String, enum: MOOD_STATES, required: true },
    moodConfidence: { type: Number, min: 0, max: 1, required: true },
    moodScores: { type: Map, of: Number, default: undefined },
    topk: { type: [topkSchema], default: undefined },

    // ── Arousal head (primary clinical signal) ──
    arousal: { type: String, enum: AROUSAL_STATES, required: true },
    arousalConfidence: { type: Number, min: 0, max: 1, default: 0 },
    arousalScores: { type: Map, of: Number, default: undefined },
    /** Arousal implied by the top mood — a cross-check against the arousal head. */
    arousalFromMood: { type: String, enum: AROUSAL_STATES, default: undefined },

    // ── Calibration / quality ──
    /** True when top mood confidence fell below the abstain threshold → escalate to a human. */
    abstained: { type: Boolean, default: false },
    /** Quality-gate note from the service (e.g. 'silence_detected', 'audio_too_short'). */
    note: { type: String, default: null },
    temperature: { type: Number, default: undefined },
    durationSec: { type: Number, default: undefined },

    // ── Provenance ──
    scheduledTime: { type: String, default: null },
    triggeredAt: { type: Date, default: Date.now },
    source: { type: String, default: 'voice_ai_checkin' },

    isAbnormal: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'recordedAt', updatedAt: false },
  }
);

// Auto-flag concerning states or uncertain predictions.
aiMoodSchema.pre('save', function (next) {
  this.isAbnormal = ALERT_MOODS.has(this.mood) || this.abstained === true;
  next();
});

aiMoodSchema.index({ patientId: 1, recordedAt: -1 });

aiMoodSchema.statics.getHistory = function (patientId, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  return this.find({ patientId, recordedAt: { $gte: since } }).sort({ recordedAt: -1 });
};

aiMoodSchema.statics.getLatest = function (patientId) {
  return this.findOne({ patientId }).sort({ recordedAt: -1 });
};

/** Per-mood and per-arousal frequency breakdown over the last `days`. */
aiMoodSchema.statics.getStats = async function (patientId, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const match = { patientId: new mongoose.Types.ObjectId(patientId), recordedAt: { $gte: since } };

  const [moodBreakdown, arousalBreakdown] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $group: { _id: '$mood', count: { $sum: 1 }, avgConfidence: { $avg: '$moodConfidence' } } },
      { $sort: { count: -1 } },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$arousal', count: { $sum: 1 }, avgConfidence: { $avg: '$arousalConfidence' } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return { breakdown: moodBreakdown, arousalBreakdown };
};

export default model('AIMood', aiMoodSchema);
