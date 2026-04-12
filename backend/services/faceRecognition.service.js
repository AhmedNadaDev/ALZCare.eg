import Person from '../models/Person.model.js';
import { embedBuffersAllModels, embedBase64AllModels } from '../utils/mlClient.js';
import { MODEL_NAMES, MODEL_CONFIG } from '../constants/models.js';
import { rebuildAll, search as searchAnn } from '../utils/ann.js';
import { cosineSimilarity } from '../utils/similarity.js';

const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD || 0.45);
const MAX_IMAGE_COUNT = parseInt(process.env.MAX_IMAGE_COUNT || '20', 10);

// Cache for persons and ANN indices
let personsCache = new Map();
let stabilityBuffers = {}; // { model: { personId: number[] } }

const refreshCacheAndAnn = async (familyId = null) => {
  const query = familyId ? { familyId } : {};
  const persons = await Person.find(query);
  personsCache = new Map(persons.map((p) => [p._id.toString(), p]));
  stabilityBuffers = {}; // reset stability buffers on reload
  rebuildAll(persons, {});
};

const mean = (arr = []) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const std = (arr = []) => {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
};

const updateStability = (model, personId, score) => {
  if (!personId || typeof score !== 'number' || Number.isNaN(score)) return null;
  stabilityBuffers[model] = stabilityBuffers[model] || {};
  const buf = stabilityBuffers[model][personId] || [];
  const next = [...buf, score];
  const bufferSize = parseInt(process.env.STABILITY_BUFFER_SIZE || '10', 10);
  if (next.length > bufferSize) next.shift();
  stabilityBuffers[model][personId] = next;
  const current = stabilityBuffers[model][personId];
  return {
    mean: Number(mean(current).toFixed(4)),
    std: Number(std(current).toFixed(4)),
    count: current.length,
    bufferSize,
  };
};

const registerPerson = async (personData, familyId, patientId = null) => {
  const { name, age, relation, images } = personData;

  if (!name || !relation || typeof age === 'undefined') {
    throw { status: 400, message: 'name, age, relation are required' };
  }

  if (!images || !images.length) {
    throw { status: 400, message: 'At least one image is required' };
  }

  const ageNumber = Number(age);
  if (Number.isNaN(ageNumber) || ageNumber < 0) {
    throw { status: 400, message: 'age must be a non-negative number' };
  }

  const trimmedName = name.trim();
  const trimmedRelation = relation.trim();
  if (!trimmedName || !trimmedRelation) {
    throw { status: 400, message: 'name and relation cannot be empty' };
  }

  if (images.length > MAX_IMAGE_COUNT) {
    throw { status: 400, message: `Maximum ${MAX_IMAGE_COUNT} images allowed` };
  }

  // Extract embeddings from images
  let mlResponse;
  try {
    mlResponse = await embedBuffersAllModels(images);
  } catch (err) {
    throw { status: 400, message: 'Failed to extract embeddings from images', details: err.message };
  }

  const perModel = mlResponse.faces || {};
  const embeddingsPayload = {};
  const stats = {};

  MODEL_NAMES.forEach((model) => {
    const faces = perModel[model] || [];
    const valid = faces
      .map((f) => f.embedding)
      .filter((emb) => Array.isArray(emb) && emb.length === MODEL_CONFIG[model].dim);
    embeddingsPayload[model] = valid;
    stats[model] = valid.length;
  });

  const totalEmbeddings = Object.values(stats).reduce((a, b) => a + b, 0);
  if (!totalEmbeddings) {
    throw { status: 400, message: 'No valid embeddings extracted from images' };
  }

  // Create person record
  const person = await Person.create({
    name: trimmedName,
    age: ageNumber,
    relation: trimmedRelation,
    familyId,
    patientId,
    embeddings: embeddingsPayload,
    meta: {
      enrolledModels: MODEL_NAMES.filter((m) => embeddingsPayload[m].length),
    },
  });

  // Refresh cache and ANN
  await refreshCacheAndAnn(familyId);

  return {
    id: person._id,
    name: person.name,
    counts: stats,
    message: 'Person registered successfully across models',
  };
};

export const recognizeFace = async (base64Image, familyId = null, modelName = 'all') => {
  if (!base64Image) {
    throw { status: 400, message: 'image (base64) is required' };
  }

  // Extract embeddings from image
  let mlResponse;
  try {
    mlResponse = await embedBase64AllModels(base64Image, modelName);
  } catch (err) {
    throw { status: 400, message: 'Failed to extract embeddings from image', details: err.message };
  }

  const perModel = mlResponse.faces || {};
  const baseModelFaces = perModel.buffalo_l || [];
  const maxFaces = baseModelFaces.length;

  if (!maxFaces) {
    return {
      detections: [],
      threshold: SIMILARITY_THRESHOLD,
      message: 'No face detected in the image',
    };
  }

  // Refresh cache if needed
  if (personsCache.size === 0) {
    await refreshCacheAndAnn(familyId);
  }

  const detections = [];
  for (let i = 0; i < maxFaces; i += 1) {
    const bbox = baseModelFaces[i]?.bbox || [0, 0, 0, 0];
    const scores = {};
    const stability = {};
    let bestModel = null;
    let bestScore = -1;
    let bestMatch = null;

    for (const model of MODEL_NAMES) {
      const faces = perModel[model] || [];
      const face = faces[i];
      if (!face || !Array.isArray(face.embedding)) continue;
      const emb = face.embedding;

      // Search using ANN (brute-force)
      const annResults = searchAnn(model, emb, 3, 200);
      let result;
      if (!annResults.length) {
        result = { match: null, score: -1 };
      } else {
        const top = annResults[0];
        const person = personsCache.get(top.personId);

        // Filter by familyId if provided
        if (familyId && person && person.familyId?.toString() !== familyId.toString()) {
          result = { match: null, score: -1 };
        } else {
          result = {
            match: person
              ? {
                  id: person._id.toString(),
                  name: person.name,
                  age: person.age,
                  relation: person.relation,
                  embeddingIndex: top.embeddingIndex,
                }
              : null,
            score: Number(top.score.toFixed(4)),
          };
        }
      }

      scores[model] = result;
      if (result.score > bestScore) {
        bestScore = result.score;
        bestModel = model;
        bestMatch = result.match;
      }

      if (result.match) {
        stability[model] = updateStability(model, result.match.id, result.score);
      } else {
        stability[model] = null;
      }
    }

    const matched = bestMatch && bestScore >= SIMILARITY_THRESHOLD
      ? { ...bestMatch, score: bestScore }
      : null;

    detections.push({
      bbox,
      bestModel,
      bestScore: Number(bestScore.toFixed(4)),
      matched,
      scores,
      stability,
    });
  }

  return {
    detections,
    threshold: SIMILARITY_THRESHOLD,
    models: MODEL_NAMES,
  };
};

const getRegisteredPersons = async (familyId) => {
  const persons = await Person.find({ familyId });
  return persons.map((p) => ({
    id: p._id,
    name: p.name,
    age: p.age,
    relation: p.relation,
    enrolledModels: p.meta?.enrolledModels || [],
    createdAt: p.createdAt,
  }));
};

// Initialize cache on service load
refreshCacheAndAnn().catch(console.error);

// Export service object
export default {
  registerPerson,
  recognizeFace,
  getRegisteredPersons
};
