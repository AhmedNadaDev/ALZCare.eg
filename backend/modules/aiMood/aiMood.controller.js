/**
 * aiMood.controller.js
 *
 * AI mood check-in endpoints — fully traced for production debugging.
 *
 * Each handler logs:
 *   [aiMoodCtrl/<action>] prefix  +  step-level breadcrumbs
 *
 * analyzeAndSave pipeline:
 *   STEP A — validate incoming file (size, mime, buffer)
 *   STEP B — call Python emotion service
 *   STEP C — persist AIMood to MongoDB
 *   STEP D — emit Socket.IO mood:updated
 *   STEP E — return HTTP 201
 */

import AIMood from './AIMood.model.js';
import MoodSchedule from './MoodSchedule.model.js';
import { analyzeEmotion, checkEmotionService } from './emotion.service.js';
import { emitToPatientRoom } from '../socket/socketManager.js';
import { rescheduleForPatient } from './moodCheckin.scheduler.js';

// ── Schedule endpoints ────────────────────────────────────────────────────────

/**
 * POST /schedule
 * Body: { patientId, scheduledTimes: ["HH:MM", ...], isActive? }
 * Backward-compat: also accepts { scheduledTime: "HH:MM" } (single string).
 */
export const setSchedule = async (req, res) => {
  const LOG = '[aiMoodCtrl/setSchedule]';
  try {
    const { patientId, isActive = true } = req.body;

    // Accept both old (single string) and new (array) format
    let scheduledTimes = req.body.scheduledTimes;
    if (!scheduledTimes && req.body.scheduledTime) {
      scheduledTimes = [req.body.scheduledTime];  // backward compat
    }

    console.log(`${LOG} patientId=${patientId} times=${JSON.stringify(scheduledTimes)} isActive=${isActive}`);

    if (!patientId || !scheduledTimes?.length) {
      return res.status(400).json({
        success: false,
        message: 'patientId and scheduledTimes (array of HH:MM strings) are required.',
      });
    }

    // Validate each time slot
    const timeRegex = /^\d{2}:\d{2}$/;
    const invalid = scheduledTimes.filter((t) => !timeRegex.test(t));
    if (invalid.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid time format(s): ${invalid.join(', ')}. Must be HH:MM (24-hour).`,
      });
    }

    // Deduplicate times within the request
    const uniqueTimes = [...new Set(scheduledTimes)].sort();

    // Family can only manage their own patient
    if (req.userRole === 'family' && req.patientId?.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage schedules for your own patient.',
      });
    }

    const creatorModel = req.userRole === 'doctor' ? 'Doctor' : 'Family';

    const schedule = await MoodSchedule.findOneAndUpdate(
      { patientId },
      {
        scheduledTimes: uniqueTimes,
        isActive,
        createdBy: req.user._id,
        createdByModel: creatorModel,
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`${LOG} Saved schedule: ${JSON.stringify(schedule.scheduledTimes)}`);

    // Clear any today-trigger locks for this patient so new times can fire
    rescheduleForPatient(patientId);

    return res.status(200).json({
      success: true,
      message: 'Mood check-in schedule saved.',
      data: schedule,
    });
  } catch (err) {
    console.error(`[aiMoodCtrl/setSchedule] ERROR:`, err.message, err.stack);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /schedule/:patientId
 */
export const getSchedule = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (req.userRole === 'family' && req.patientId?.toString() !== patientId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const schedule = await MoodSchedule.findOne({ patientId });
    return res.status(200).json({ success: true, data: schedule || null });
  } catch (err) {
    console.error('[aiMoodCtrl/getSchedule] ERROR:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── History / stats ───────────────────────────────────────────────────────────

/** GET /history/:patientId?days=30&limit=50 */
export const getHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const days  = Math.min(parseInt(req.query.days  || '30', 10), 365);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

    if (req.userRole === 'family' && req.patientId?.toString() !== patientId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const since = new Date(Date.now() - days * 86400_000);
    const moods = await AIMood.find({ patientId, recordedAt: { $gte: since } })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, data: moods, count: moods.length });
  } catch (err) {
    console.error('[aiMoodCtrl/getHistory] ERROR:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /latest/:patientId */
export const getLatest = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (req.userRole === 'family' && req.patientId?.toString() !== patientId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const latest = await AIMood.findOne({ patientId }).sort({ recordedAt: -1 }).lean();
    return res.status(200).json({ success: true, data: latest || null });
  } catch (err) {
    console.error('[aiMoodCtrl/getLatest] ERROR:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /stats/:patientId?days=30 */
export const getStats = async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);

    if (req.userRole === 'family' && req.patientId?.toString() !== patientId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const stats = await AIMood.getStats(patientId, days);
    const total = stats.reduce((s, x) => s + x.count, 0);

    return res.status(200).json({
      success: true,
      data: { breakdown: stats, totalEntries: total, days },
    });
  } catch (err) {
    console.error('[aiMoodCtrl/getStats] ERROR:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /service-status — dev/ops helper to check Python service health */
export const getServiceStatus = async (req, res) => {
  const { healthy, latencyMs, error } = await checkEmotionService();
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: { healthy, latencyMs, error: error || null },
  });
};

// ── Patient audio-analysis endpoint ──────────────────────────────────────────

/**
 * POST /analyze
 *
 * Fully traced pipeline — every step logs to [aiMoodCtrl/analyze] so you can
 * pinpoint exactly where a failure occurs.
 *
 * The health check is intentionally moved INTO the catch block of analyzeEmotion
 * (not run before every call) to avoid the extra 5 s latency and false negatives
 * during model inference on the Python side.
 */
export const analyzeAndSave = async (req, res) => {
  const LOG = '[aiMoodCtrl/analyze]';
  const t0  = Date.now();

  // ── STEP A: Validate incoming file ─────────────────────────────────────────
  console.log(`${LOG} STEP A — request received`);

  if (!req.file) {
    console.error(`${LOG} STEP A ERROR — no file in request. Check multer field name is "audio"`);
    return res.status(400).json({
      success: false,
      message: 'No audio file provided. Send field name "audio" as multipart/form-data.',
    });
  }

  const { buffer, mimetype, originalname, size } = req.file;
  const patientId     = req.user._id.toString();
  const scheduledTime = req.body?.scheduledTime || null;

  console.log(
    `${LOG} STEP A — file OK: ` +
    `name="${originalname}" size=${size}B mime="${mimetype}" ` +
    `patientId=${patientId} scheduledTime=${scheduledTime}`
  );

  if (!buffer || buffer.length === 0) {
    console.error(`${LOG} STEP A ERROR — buffer is empty after multer`);
    return res.status(400).json({
      success: false,
      message: 'Received file buffer is empty — upload may have been corrupted.',
    });
  }

  // ── STEP B: Call Python emotion service ────────────────────────────────────
  console.log(`${LOG} STEP B — calling emotion service…`);

  let emotionResult;
  try {
    emotionResult = await analyzeEmotion(buffer, mimetype, originalname || 'audio.webm');
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`${LOG} STEP B ERROR after ${elapsed}ms:`, err.message);

    // Run health check ONLY on failure to give a meaningful error message
    const { healthy, error: healthErr } = await checkEmotionService();
    if (!healthy) {
      return res.status(503).json({
        success: false,
        message: 'Emotion analysis service is offline or not responding.',
        detail: healthErr || err.message,
        hint: 'cd emotion_project && uvicorn main:app --host 0.0.0.0 --port 8001',
      });
    }

    return res.status(502).json({
      success: false,
      message: 'Emotion analysis failed — Python service returned an error.',
      detail: err.message,
    });
  }

  const { emotion, confidence, allScores, note } = emotionResult;
  console.log(`${LOG} STEP B — emotion="${emotion}" confidence=${confidence} note=${note || 'none'}`);

  // ── STEP C: Persist to MongoDB ─────────────────────────────────────────────
  console.log(`${LOG} STEP C — saving AIMood to MongoDB…`);

  let aiMood;
  try {
    aiMood = await AIMood.create({
      patientId,
      emotion,
      confidence,
      allScores,
      scheduledTime,
      triggeredAt: new Date(),
      source: 'voice_ai_checkin',
    });
    console.log(`${LOG} STEP C — saved _id=${aiMood._id}`);
  } catch (err) {
    console.error(`${LOG} STEP C ERROR — MongoDB save failed:`, err.message);
    return res.status(500).json({
      success: false,
      message: `Failed to save emotion result to database: ${err.message}`,
    });
  }

  // ── STEP D: Socket.IO real-time emit ───────────────────────────────────────
  console.log(`${LOG} STEP D — emitting mood:updated to patient room…`);
  try {
    emitToPatientRoom(patientId, 'mood:updated', { mood: aiMood.toObject() });
    console.log(`${LOG} STEP D — mood:updated emitted`);
  } catch (err) {
    // Non-fatal: DB save already succeeded
    console.error(`${LOG} STEP D WARNING — Socket emit failed:`, err.message);
  }

  // ── STEP E: Respond ────────────────────────────────────────────────────────
  const totalMs = Date.now() - t0;
  console.log(`${LOG} STEP E — SUCCESS total=${totalMs}ms emotion="${emotion}" conf=${confidence}`);

  return res.status(201).json({
    success: true,
    message: `Emotion detected: ${emotion}`,
    data: aiMood,
  });
};
