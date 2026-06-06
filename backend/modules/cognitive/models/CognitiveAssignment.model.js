import mongoose from 'mongoose';

/**
 * CognitiveAssignment  ("PatientAssignments")
 *
 * Links a piece of cognitive content — either an ExerciseTemplate or a
 * MemoryAlbum — to a specific patient, with per-patient configuration
 * (difficulty, duration, enable/disable, merged config). This is the single
 * source of truth for "what is active for this patient" and is what schedules
 * and sessions reference.
 */
const cognitiveAssignmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    kind: {
      type: String,
      enum: ['exercise', 'album'],
      required: [true, 'Assignment kind is required'],
    },
    // Exactly one of these is set depending on `kind`
    exerciseTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExerciseTemplate',
      default: null,
    },
    // Denormalized from the template so schedules/sessions avoid an extra join.
    exerciseType: {
      type: String,
      default: null,
    },
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MemoryAlbum',
      default: null,
    },
    title: {
      type: String, // cached display title for fast listing
      trim: true,
      maxlength: 160,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    durationSec: {
      type: Number,
      default: 180,
      min: 0, // 0 = no fixed duration (e.g. album sessions are self-paced)
    },
    /** Per-assignment overrides merged over the template's defaultConfig. */
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    autoStart: {
      type: Boolean,
      default: false, // auto-open the player when a scheduled session fires
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

cognitiveAssignmentSchema.index({ patient: 1, enabled: 1 });
cognitiveAssignmentSchema.index({ patient: 1, kind: 1 });
cognitiveAssignmentSchema.index({ album: 1 });
cognitiveAssignmentSchema.index({ exerciseTemplate: 1 });

const CognitiveAssignment = mongoose.model('CognitiveAssignment', cognitiveAssignmentSchema);

export default CognitiveAssignment;
