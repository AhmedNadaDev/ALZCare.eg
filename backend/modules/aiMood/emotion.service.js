/**
 * emotion.service.js
 *
 * HTTP client: Node.js → Python FastAPI emotion microservice.
 *
 * All interactions are traced with [EmotionSvc] console logs so pipeline
 * failures can be pinpointed without guessing which layer broke.
 */

import axios from 'axios';
import FormData from 'form-data';

const EMOTION_SERVICE_URL =
  process.env.EMOTION_SERVICE_URL || 'http://localhost:8001';

const TIMEOUT_MS = 45_000;   // 45 s — CPU inference can be slow on first call

/**
 * Forward a raw audio buffer to the Python service.
 *
 * @param {Buffer}  audioBuffer   Raw audio bytes (WebM, OGG, WAV, MP4 …)
 * @param {string}  mimeType      MIME type reported by multer
 * @param {string}  filename      Original filename (used to pick extension)
 * @returns {Promise<{ emotion: string, confidence: number, allScores?: object, note?: string }>}
 */
export const analyzeEmotion = async (
  audioBuffer,
  mimeType = 'audio/webm',
  filename = 'audio.webm'
) => {
  const LOG = '[EmotionSvc]';

  console.log(
    `${LOG} → /emotion/analyze | size=${audioBuffer.length} bytes | mime=${mimeType} | file=${filename}`
  );

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('analyzeEmotion received an empty buffer — nothing to send to Python');
  }

  const form = new FormData();
  form.append('audio', audioBuffer, {
    filename,
    contentType: mimeType,
    knownLength: audioBuffer.length,
  });

  const headers = form.getHeaders();
  console.log(`${LOG} FormData headers:`, JSON.stringify(headers));

  let response;
  const t0 = Date.now();

  try {
    response = await axios.post(
      `${EMOTION_SERVICE_URL}/emotion/analyze`,
      form,
      {
        headers,
        timeout: TIMEOUT_MS,
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
      }
    );
  } catch (axiosErr) {
    const elapsed = Date.now() - t0;
    // Structured error so callers can handle HTTP vs network separately
    if (axiosErr.response) {
      // Python returned a non-2xx status
      console.error(
        `${LOG} Python returned HTTP ${axiosErr.response.status} in ${elapsed}ms:`,
        JSON.stringify(axiosErr.response.data)
      );
      const detail = axiosErr.response.data?.detail || JSON.stringify(axiosErr.response.data);
      throw new Error(`Python service error (HTTP ${axiosErr.response.status}): ${detail}`);
    } else if (axiosErr.code === 'ECONNREFUSED') {
      console.error(`${LOG} Connection refused — is the Python service running on ${EMOTION_SERVICE_URL}?`);
      throw new Error(
        `Cannot reach emotion service at ${EMOTION_SERVICE_URL}. ` +
        'Start it with: cd emotion_project && uvicorn main:app --port 8001'
      );
    } else if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
      console.error(`${LOG} Request timed out after ${elapsed}ms`);
      throw new Error(`Emotion analysis timed out after ${TIMEOUT_MS / 1000}s — model may still be loading`);
    } else {
      console.error(`${LOG} Axios error (${axiosErr.code}) in ${elapsed}ms:`, axiosErr.message);
      throw new Error(`Emotion service request failed: ${axiosErr.message}`);
    }
  }

  const elapsed = Date.now() - t0;
  console.log(`${LOG} ← HTTP ${response.status} in ${elapsed}ms | body:`, JSON.stringify(response.data));

  const { emotion, confidence, all_scores: allScores, note } = response.data;

  if (!emotion) {
    throw new Error(
      `Python service returned a response without an emotion field: ${JSON.stringify(response.data)}`
    );
  }

  console.log(`${LOG} Result: emotion="${emotion}" confidence=${confidence} note=${note || 'none'}`);

  return { emotion, confidence, allScores, note };
};

/**
 * Lightweight health probe — does NOT throw.
 * Returns { healthy: boolean, latencyMs: number, error?: string }
 */
export const checkEmotionService = async () => {
  const t0 = Date.now();
  try {
    const { data } = await axios.get(`${EMOTION_SERVICE_URL}/health`, {
      timeout: 5_000,
    });
    const latencyMs = Date.now() - t0;
    const healthy = data?.status === 'ok';
    console.log(`[EmotionSvc] Health check: ${healthy ? 'OK' : 'DEGRADED'} (${latencyMs}ms)`);
    return { healthy, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const error = err.code === 'ECONNREFUSED'
      ? `Service not running on ${EMOTION_SERVICE_URL}`
      : err.message;
    console.warn(`[EmotionSvc] Health check FAILED (${latencyMs}ms):`, error);
    return { healthy: false, latencyMs, error };
  }
};

// Keep backward-compat export name
export const isEmotionServiceHealthy = async () => {
  const { healthy } = await checkEmotionService();
  return healthy;
};
