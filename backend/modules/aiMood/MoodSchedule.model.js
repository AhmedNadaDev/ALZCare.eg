/**
 * MoodSchedule.model.js
 *
 * One document per patient — stores MULTIPLE daily AI voice mood check-in times.
 *
 * Each time slot in scheduledTimes[] fires independently once per calendar day.
 *
 * Breaking change from v1 (single scheduledTime string):
 *   - Old field `scheduledTime` is replaced by `scheduledTimes: [String]`.
 *   - The controller's setSchedule handler accepts both formats and converts.
 */

import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const TIME_REGEX = /^\d{2}:\d{2}$/;

const moodScheduleSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true,   // exactly one schedule document per patient
      index: true,
    },

    /**
     * Array of "HH:MM" times (24-hour) when mood check-ins should fire.
     * Example: ["09:00", "14:00", "20:00"]
     * Max 6 slots per day to prevent abuse.
     */
    scheduledTimes: {
      type: [String],
      required: true,
      default: ['09:00'],
      validate: [
        {
          validator: (times) =>
            Array.isArray(times) &&
            times.length >= 1 &&
            times.length <= 6 &&
            times.every((t) => TIME_REGEX.test(t)),
          message:
            'scheduledTimes must be 1–6 "HH:MM" strings (24-hour). Max 6 daily slots.',
        },
      ],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /** Who created / last modified this schedule */
    createdBy: {
      type: Schema.Types.ObjectId,
      refPath: 'createdByModel',
    },
    createdByModel: {
      type: String,
      enum: ['Doctor', 'Family'],
    },
  },
  { timestamps: true }
);

export default model('MoodSchedule', moodScheduleSchema);
