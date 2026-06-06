import mongoose from 'mongoose';

/**
 * CognitiveSchedule  ("ExerciseSchedule")
 *
 * Recurrence rule that activates sessions for an assignment. Mirrors the
 * proven DailyPlan scheduling approach: a server-side cron scans active
 * schedules every minute and fires a precise timer at HH:MM.
 *
 * recurrence:
 *   once   — single run on `date`
 *   daily  — every day at `time`
 *   weekly — on the given `daysOfWeek` at `time`
 *   custom — same as weekly but semantically "irregular" set of days
 */
const cognitiveScheduleSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CognitiveAssignment',
      required: [true, 'Assignment is required'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    recurrence: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'custom'],
      default: 'daily',
    },
    daysOfWeek: [
      {
        type: String,
        enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      },
    ],
    time: {
      type: String,
      required: [true, 'Scheduled time is required'],
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'],
    },
    date: {
      type: Date, // used only for one-time schedules
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdByModel',
    },
    createdByModel: {
      type: String,
      enum: ['Doctor', 'Family', 'Patient'],
      default: 'Family',
    },
  },
  { timestamps: true }
);

cognitiveScheduleSchema.index({ patient: 1, isActive: 1 });
cognitiveScheduleSchema.index({ isActive: 1, time: 1 });
cognitiveScheduleSchema.index({ assignment: 1 });

const CognitiveSchedule = mongoose.model('CognitiveSchedule', cognitiveScheduleSchema);

export default CognitiveSchedule;
