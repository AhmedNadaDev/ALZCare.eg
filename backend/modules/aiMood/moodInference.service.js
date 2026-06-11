/**
 * moodInference.service.js
 *
 * Service layer: Node.js → Python FastAPI mood-detection microservice
 * (backend/mood_service, WavLM multi-task model).
 *
 * The Node backend never runs PyTorch itself; it forwards the audio buffer to the
 * Python sidecar over localhost HTTP and returns the structured mood + arousal result.
 *
 * All interactions are traced with [MoodSvc] logs so pipeline failures can be
 * pinpointed without guessing which layer broke.
 */

import axios from 'axios';
import FormData from 'form-data';

const MOOD_SERVICE_URL =
  process.env.MOOD_SERVICE_URL || process.env.EMOTION_SERVICE_URL || 'http://localhost:8001';

const TIMEOUT_MS = 45_000; // CPU inference can be slow on the first call.

/** Start hint shown in error responses when the sidecar is unreachable. */
export const START_HINT = 'cd backend/mood_service && uvicorn main:app --host 0.0.0.0 --port 8001';

/**
 * Forward a raw audio buffer to the Python mood service.
 *
 * @param {Buffer} audioBuffer  Raw audio bytes (WAV preferred; WebM/OGG need ffmpeg server-side)
 * @param {string} mimeType     MIME type reported by multer
 * @param {string} filename     Original filename (used to pick extension)
 * @returns {Promise<object>}   Structured prediction (mood, arousal, scores, …)
 */
export const analyzeMood = async (audioBuffer, mimeType = 'audio/wav', filename = 'audio.wav') => {
  const LOG = '[MoodSvc]';
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('analyzeMood received an empty buffer — nothing to send to the model service');
  }

  console.log(`${LOG} → /mood/analyze | size=${audioBuffer.length}B | mime=${mimeType} | file=${filename}`);

  const form = new FormData();
  form.append('audio', audioBuffer, { filename, contentType: mimeType, knownLength: audioBuffer.length });

  let response;
  const t0 = Date.now();
  try {
    response = await axios.post(`${MOOD_SERVICE_URL}/mood/analyze`, form, {
      headers: form.getHeaders(),
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    if (err.response) {
      const detail = err.response.data?.detail || JSON.stringify(err.response.data);
      console.error(`${LOG} HTTP ${err.response.status} in ${elapsed}ms: ${detail}`);
      throw new Error(`Mood service error (HTTP ${err.response.status}): ${detail}`);
    }
    if (err.code === 'ECONNREFUSED') {
      console.error(`${LOG} Connection refused at ${MOOD_SERVICE_URL}`);
      throw new Error(`Cannot reach mood service at ${MOOD_SERVICE_URL}. Start it with: ${START_HINT}`);
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      console.error(`${LOG} Timed out after ${elapsed}ms`);
      throw new Error(`Mood analysis timed out after ${TIMEOUT_MS / 1000}s — the model may still be loading`);
    }
    console.error(`${LOG} Axios error (${err.code}) in ${elapsed}ms: ${err.message}`);
    throw new Error(`Mood service request failed: ${err.message}`);
  }

  const elapsed = Date.now() - t0;
  const data = response.data || {};
  console.log(`${LOG} ← HTTP ${response.status} in ${elapsed}ms | mood=${data.mood} arousal=${data.arousal} note=${data.note || 'none'}`);

  if (!data.mood || !data.arousal) {
    throw new Error(`Mood service returned an incomplete response: ${JSON.stringify(data)}`);
  }
  return data;
};

/**
 * Lightweight health probe — never throws.
 * @returns {Promise<{healthy: boolean, latencyMs: number, error?: string, info?: object}>}
 */
export const checkMoodService = async () => {
  const t0 = Date.now();
  try {
    const { data } = await axios.get(`${MOOD_SERVICE_URL}/health`, { timeout: 5_000 });
    const latencyMs = Date.now() - t0;
    const healthy = data?.status === 'ok';
    console.log(`[MoodSvc] Health: ${healthy ? 'OK' : 'DEGRADED'} (${latencyMs}ms)`);
    return { healthy, latencyMs, info: data };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const error = err.code === 'ECONNREFUSED' ? `Service not running on ${MOOD_SERVICE_URL}` : err.message;
    console.warn(`[MoodSvc] Health FAILED (${latencyMs}ms): ${error}`);
    return { healthy: false, latencyMs, error };
  }
};
