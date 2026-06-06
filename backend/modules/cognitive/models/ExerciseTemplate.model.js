import mongoose from 'mongoose';

/**
 * ExerciseTemplate
 *
 * Data-driven definition of a cognitive exercise. The exercise engine renders
 * a player purely from `type` + merged `config` — no game logic is hardcoded
 * per exercise. System templates are seeded on startup and cannot be deleted;
 * additional templates can be created by the platform later without code
 * changes.
 *
 * Supported types map 1:1 to a frontend renderer:
 *   face_recognition  — recognise a known person from the patient's memory pool
 *   memory_recall     — recall details about a shown memory item
 *   sequence_memory   — reproduce a shown sequence (Simon-style)
 *   daily_routine     — order the steps of a daily routine correctly
 *   voice_recognition — respond by voice to a spoken prompt
 */
const exerciseTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Template key is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    type: {
      type: String,
      enum: ['face_recognition', 'memory_recall', 'sequence_memory', 'daily_routine', 'voice_recognition'],
      required: [true, 'Exercise type is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    icon: {
      type: String, // icon key resolved on the frontend
      default: 'brain',
    },
    skills: [{ type: String, trim: true }], // e.g. ['recognition', 'recall', 'attention']
    difficultyLevels: {
      type: [String],
      enum: ['easy', 'medium', 'hard'],
      default: ['easy', 'medium', 'hard'],
    },
    /**
     * Default configuration merged with per-assignment overrides.
     * Shape is exercise-specific, e.g.:
     *   { rounds: 5, optionsPerRound: 4, promptTimeoutSec: 30, sequenceStart: 3 }
     */
    defaultConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    defaultDurationSec: {
      type: Number,
      default: 180,
      min: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: true, // system templates can be disabled but not deleted
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

exerciseTemplateSchema.index({ isActive: 1, order: 1 });

const ExerciseTemplate = mongoose.model('ExerciseTemplate', exerciseTemplateSchema);

export default ExerciseTemplate;
