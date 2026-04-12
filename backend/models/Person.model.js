import mongoose from 'mongoose';
import { MODEL_CONFIG, MODEL_NAMES } from '../constants/models.js';

const validateEmbedding = (embedding, dim) => {
  if (!Array.isArray(embedding) || embedding.length !== dim) {
    return false;
  }
  return embedding.every((val) => typeof val === 'number' && !Number.isNaN(val));
};

const embeddingSchemaForModel = (model) => {
  const dim = MODEL_CONFIG[model].dim;
  return {
    type: [[Number]],
    default: [],
    validate: {
      validator: (embeddings) => {
        if (!embeddings || embeddings.length === 0) return true; // allow empty, enforce on app layer
        return embeddings.every((emb) => validateEmbedding(emb, dim));
      },
      message: `Each ${model} embedding must be an array of exactly ${dim} numbers`,
    },
  };
};

const personSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0 },
    relation: { type: String, required: true, trim: true },
    familyId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Family', 
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      index: true
    },
    embeddings: {
      buffalo_l: embeddingSchemaForModel('buffalo_l'),
      facenet: embeddingSchemaForModel('facenet'),
      vggface2: embeddingSchemaForModel('vggface2'),
    },
    meta: {
      enrolledModels: {
        type: [String],
        default: [],
        enum: MODEL_NAMES,
      },
    },
  },
  { timestamps: true }
);

personSchema.index({ name: 1, relation: 1 });
personSchema.index({ 'meta.enrolledModels': 1 });
personSchema.index({ familyId: 1, patientId: 1 });

export default mongoose.model('Person', personSchema);
