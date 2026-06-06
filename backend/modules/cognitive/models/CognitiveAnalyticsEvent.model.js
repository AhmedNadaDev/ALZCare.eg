import mongoose from 'mongoose';

/**
 * CognitiveAnalyticsEvent  ("AnalyticsEvents")
 *
 * Append-only event log capturing fine-grained cognitive activity. Sessions
 * hold the authoritative outcome; this log powers time-bucketed analytics
 * (best active hours, engagement frequency, interaction counts) without
 * scanning full session documents. `hourOfDay` / `dayOfWeek` are pre-computed
 * at write time so aggregations stay cheap and index-friendly.
 */
const cognitiveAnalyticsEventSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CognitiveSession',
      default: null,
    },
    type: {
      type: String,
      enum: [
        'session_started',
        'session_completed',
        'session_abandoned',
        'session_missed',
        'schedule_triggered',
        'album_viewed',
        'item_viewed',
        'answer_correct',
        'answer_wrong',
        'assignment_created',
      ],
      required: [true, 'Event type is required'],
    },
    kind: {
      type: String,
      enum: ['exercise', 'album', null],
      default: null,
    },
    exerciseType: {
      type: String,
      default: null,
    },
    value: {
      type: Number, // generic numeric payload (score, count, ms)
      default: null,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
    },
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

cognitiveAnalyticsEventSchema.index({ patient: 1, occurredAt: -1 });
cognitiveAnalyticsEventSchema.index({ patient: 1, type: 1, occurredAt: -1 });
cognitiveAnalyticsEventSchema.index({ patient: 1, exerciseType: 1 });
cognitiveAnalyticsEventSchema.index({ patient: 1, hourOfDay: 1 });

const CognitiveAnalyticsEvent = mongoose.model('CognitiveAnalyticsEvent', cognitiveAnalyticsEventSchema);

export default CognitiveAnalyticsEvent;
