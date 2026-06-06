import mongoose from 'mongoose';

/**
 * MemoryAlbum
 *
 * A themed collection of memory items (photos, videos, voice notes) belonging
 * to a single patient. Created and managed by family members or doctors.
 * Items live in their own collection (MemoryItem) for scalability — an album
 * keeps a denormalized `itemCount` for fast list rendering.
 */
const memoryAlbumSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
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
    title: {
      type: String,
      required: [true, 'Album title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      enum: ['family', 'friends', 'places', 'events', 'pets', 'achievements', 'other'],
      default: 'family',
    },
    coverImage: {
      type: String, // /uploads/memory/... URL
      default: null,
    },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    emotion: {
      type: String,
      enum: ['joy', 'love', 'nostalgia', 'pride', 'calm', 'neutral'],
      default: 'neutral',
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

memoryAlbumSchema.index({ patient: 1, isActive: 1 });
memoryAlbumSchema.index({ patient: 1, category: 1 });
memoryAlbumSchema.index({ createdBy: 1 });

const MemoryAlbum = mongoose.model('MemoryAlbum', memoryAlbumSchema);

export default MemoryAlbum;
