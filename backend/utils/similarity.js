/**
 * Compute L2 norm (Euclidean norm) of a vector.
 * @param {number[]} vector - Input vector
 * @returns {number} L2 norm
 */
const norm = (vector = []) => {
  if (!Array.isArray(vector) || vector.length === 0) {
    return 0;
  }
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
};

/**
 * L2-normalize a vector in place (returns new array).
 * @param {number[]} vector - Input vector
 * @returns {number[]} L2-normalized vector
 */
export const l2Normalize = (vector = []) => {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Cannot normalize empty vector');
  }
  const n = norm(vector);
  if (n === 0) {
    throw new Error('Cannot normalize zero vector');
  }
  return vector.map((v) => v / n);
};

/**
 * Compute cosine similarity between two vectors.
 * For L2-normalized vectors, this is equivalent to dot product.
 * 
 * @param {number[]} a - First vector (should be L2-normalized)
 * @param {number[]} b - Second vector (should be L2-normalized)
 * @returns {number} Cosine similarity score in range [-1, 1] (typically [0, 1] for normalized vectors)
 */
export const cosineSimilarity = (a = [], b = []) => {
  // Validation
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return 0;
  }
  
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  
  // Dimension mismatch - return 0 (or could throw error in strict mode)
  if (a.length !== b.length) {
    console.warn(
      `Dimension mismatch: a.length=${a.length}, b.length=${b.length}. Returning 0.`
    );
    return 0;
  }

  // Compute norms
  const nA = norm(a);
  const nB = norm(b);
  
  // Handle zero vectors
  if (nA === 0 || nB === 0) {
    return 0;
  }

  // For L2-normalized vectors, norm should be ~1.0 (within floating point precision)
  // If embeddings are properly normalized, cosine similarity = dot product
  const dot = a.reduce((sum, v, idx) => {
    const bVal = b[idx];
    if (typeof bVal !== 'number' || Number.isNaN(bVal)) {
      return sum;
    }
    return sum + v * bVal;
  }, 0);

  const similarity = dot / (nA * nB);
  
  // Clamp to [-1, 1] to handle floating point errors
  return Math.max(-1, Math.min(1, similarity));
};

/**
 * Validate that an embedding has the correct dimension and is roughly normalized.
 * @param {number[]} embedding - Embedding vector to validate
 * @param {number} tolerance - Tolerance for normalization check (default 0.01)
 * @returns {boolean} True if valid
 */
export const validateEmbedding = (embedding, tolerance = 0.01) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return false;
  }
  
  const n = norm(embedding);
  // Check if normalized (norm should be approximately 1.0)
  // Allow some tolerance for floating point precision
  return Math.abs(n - 1.0) < tolerance;
};
