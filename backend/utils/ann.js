import { MODEL_CONFIG } from '../constants/models.js';

// ANN search using brute-force cosine similarity
const indices = {};
const labelMeta = {}; // model -> Map<label, meta>
const bruteStore = {}; // model -> array of { emb, personId, embeddingIndex }

const cosine = (a = [], b = []) => {
  if (!a.length || !b.length || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? -1 : dot / denom;
};

export const rebuildAll = (persons, annConfig) => {
  Object.keys(indices).forEach((model) => {
    delete indices[model];
    delete labelMeta[model];
  });
  Object.keys(bruteStore).forEach((model) => delete bruteStore[model]);

  const grouped = {};
  persons.forEach((p) => {
    Object.entries(p.embeddings || {}).forEach(([model, embs]) => {
      if (!MODEL_CONFIG[model] || !embs?.length) return;
      grouped[model] = grouped[model] || [];
      embs.forEach((emb, embIdx) => {
        grouped[model].push({ emb, personId: p._id.toString(), embeddingIndex: embIdx });
      });
    });
  });

  Object.entries(grouped).forEach(([model, items]) => {
    const dim = MODEL_CONFIG[model].dim;
    // ANN disabled: store for brute-force search
    bruteStore[model] = items.filter((item) => Array.isArray(item.emb) && item.emb.length === dim);
  });
};

export const addEmbeddings = (personId, embeddings, annConfig) => {
  Object.entries(embeddings || {}).forEach(([model, embs]) => {
    if (!MODEL_CONFIG[model] || !embs?.length) return;
    const dim = MODEL_CONFIG[model].dim;
    bruteStore[model] = bruteStore[model] || [];
    embs.forEach((emb, embIdx) => {
      if (!Array.isArray(emb) || emb.length !== dim) return;
      bruteStore[model].push({ emb, personId, embeddingIndex: embIdx });
    });
  });
};

export const search = (model, queryEmbedding, k, efSearchOverride) => {
  const pool = bruteStore[model] || [];
  const scored = pool
    .map((item) => ({ score: cosine(queryEmbedding, item.emb), ...item }))
    .filter((r) => r.score !== -1)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return scored;
};
