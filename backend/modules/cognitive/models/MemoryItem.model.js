import mongoose from 'mongoose';

/**
 * MemoryItem
 *
 * A single memory unit inside an album: a photo, video, audio clip, or text
 * note enriched with biographical metadata (who, relationship, story, emotion).
 * `patient` is denormalized from the parent album so the patient experience and
 * exercise engine can query a patient's whole memory pool without a join.
 */
const memoryItemSchema = new mongoose.Schema(
  {
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MemoryAlbum',
      required: [true, 'Album is required'],
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'text'],
      default: 'image',
    },
    mediaUrl: {
      type: String, // main media file URL (image/video/audio)
      default: null,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    voiceNoteUrl: {
      type: String, // optional spoken memory attached to any item type
      default: null,
    },
    name: {
      type: String, // person / place / subject name
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    relationship: {
      type: String, // e.g. "Daughter", "Best friend", "Childhood home"
      trim: true,
      maxlength: [80, 'Relationship cannot exceed 80 characters'],
    },
    story: {
      type: String, // the memory description / narrative
      trim: true,
      maxlength: [5000, 'Story cannot exceed 5000 characters'],
    },
    emotion: {
      type: String,
      enum: ['joy', 'love', 'nostalgia', 'pride', 'calm', 'neutral'],
      default: 'neutral',
    },
    takenAt: {
      type: Date, // when the memory happened (optional)
      default: null,
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    order: {
      type: Number,
      default: 0,
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

memoryItemSchema.index({ album: 1, order: 1 });
memoryItemSchema.index({ patient: 1, type: 1 });

const MemoryItem = mongoose.model('MemoryItem', memoryItemSchema);

export default MemoryItem;
