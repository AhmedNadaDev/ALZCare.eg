/**
 * aiMood.controller.js
 *
 * AI voice mood check-in endpoints (WavLM multi-task model).
 *
 * analyzeAndSave pipeline:
 *   STEP A — validate incoming file (size, mime, buffer)
 *   STEP B — call the Python mood service (WavLM)
 *   STEP C — persist AIMood to MongoDB
 *   STEP D — create an abnormal-mood notification (if flagged)
 *   STEP E — emit Socket.IO mood:updated
 *   STEP F — return HTTP 201
 */

import AIMood from './AIMood.model.js';
import MoodSchedule from './MoodSchedule.model.js';
import Patient from '../../models/Patient.model.js';
import Notification from '../../models/Notification.model.js';
import { analyzeMood, checkMoodService, START_HINT } from './moodInference.service.js';
import { emitToPatientRoom } from '../socket/socketManager.js';
import { rescheduleForPatient } from './moodCheckin.scheduler.js';

/**
 * Verify the requesting doctor/family may act on this patient.
 *   • family — the token is pinned to one patient (req.patientId must match)
 *   • doctor — the patient's `doctor` field must equal the doctor's id
 * Returns the Patient doc on success, or null if access is denied.
 */
const resolveAccessiblePatient = async (req, patientId) => {
  if (req.userRole === 'family') {
    if (req.patientId?.toString() !== patientId) return null;
    return Patient.findById(patientId);
  }
  if (req.userRole === 'doctor') {
    const patient = await Patient.findById(patientId);
    if (!patient) return null;
    return patient.doctor?.toString() === req.user._id.toString() ? patient : null;
  }
  return null;
};

// ── Schedule endpoints ────────────────────────────────────────────────────────

/** POST /schedule  Body: { patientId, scheduledTimes: ["HH:MM", ...], isActive? } */
export const setSchedule = async (req, res) => {
  const LOG = '[aiMoodCtrl/setSchedule]';
  try {
    const { patientId, isActive = true } = req.body;
    let scheduledTimes = req.body.scheduledTimes;
    if (!scheduledTimes && req.body.scheduledTime) scheduledTimes = [req.body.scheduledTime];

    if (!patientId || !scheduledTimes?.length) {
      return res.status(400).json({
        success: false,
        message: 'patientId and scheduledTimes (array of HH:MM strings) are required.',
      });
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    const invalid = scheduledTimes.filter((t) => !timeRegex.test(t));
    if (invalid.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid time format(s): ${invalid.join(', ')}. Must be HH:MM (24-hour).`,
      });
    }

    const uniqueTimes = [...new Set(scheduledTimes)].sort();

    const patient = await resolveAccessiblePatient(req, patientId);
    if (!patient) {
      return res.status(403).json({ success: false, message: 'You do not have access to this patient.' });
    }

    const creatorModel = req.userRole === 'doctor' ? 'Doctor' : 'Family';
    const schedule = await MoodSchedule.findOneAndUpdate(
      { patientId },
      { scheduledTimes: uniqueTimes, isActive, createdBy: req.user._id, createdByModel: creatorModel },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`${LOG} Saved schedule: ${JSON.stringify(schedule.scheduledTimes)}`);
    rescheduleForPatient(patientId);

    return res.status(200).json({ success: true, message: 'Mood check-in schedule saved.', data: schedule });
  } catch (err) {
    console.error(`${LOG} ERROR:`, err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /schedule/:patientId */
export const getSchedule = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!(await resolveAccessiblePatient(req, patientId))) {
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
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

    if (!(await resolveAccessiblePatient(req, patientId))) {
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
    if (!(await resolveAccessiblePatient(req, patientId))) {
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

    if (!(await resolveAccessiblePatient(req, patientId))) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const { breakdown, arousalBreakdown } = await AIMood.getStats(patientId, days);
    const total = breakdown.reduce((s, x) => s + x.count, 0);

    return res.status(200).json({
      success: true,
      data: { breakdown, arousalBreakdown, totalEntries: total, days },
    });
  } catch (err) {
    console.error('[aiMoodCtrl/getStats] ERROR:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /service-status — Python service health (doctor/family only) */
export const getServiceStatus = async (req, res) => {
  const { healthy, latencyMs, error, info } = await checkMoodService();
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: { healthy, latencyMs, error: error || null, info: info || null },
  });
};

// ── Patient audio-analysis endpoint ──────────────────────────────────────────

/** POST /analyze  (patient JWT, multipart field "audio") */
export const analyzeAndSave = async (req, res) => {
  const LOG = '[aiMoodCtrl/analyze]';
  const t0 = Date.now();

  // ── STEP A: validate file ──
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No audio file provided. Send field name "audio" as multipart/form-data.',
    });
  }
  const { buffer, mimetype, originalname, size } = req.file;
  const patientId = req.user._id.toString();
  const scheduledTime = req.body?.scheduledTime || null;

  console.log(`${LOG} STEP A — name="${originalname}" size=${size}B mime="${mimetype}" patient=${patientId}`);
  if (!buffer || buffer.length === 0) {
    return res.status(400).json({ success: false, message: 'Received file buffer is empty — upload may have been corrupted.' });
  }

  // ── STEP B: call Python mood service ──
  let result;
  try {
    result = await analyzeMood(buffer, mimetype, originalname || 'audio.wav');
  } catch (err) {
    console.error(`${LOG} STEP B ERROR after ${Date.now() - t0}ms:`, err.message);
    const { healthy, error: healthErr } = await checkMoodService();
    if (!healthy) {
      return res.status(503).json({
        success: false,
        message: 'Mood analysis service is offline or not responding.',
        detail: healthErr || err.message,
        hint: START_HINT,
      });
    }
    return res.status(502).json({
      success: false,
      message: 'Mood analysis failed — Python service returned an error.',
      detail: err.message,
    });
  }

  // ── STEP C: persist ──
  let aiMood;
  try {
    aiMood = await AIMood.create({
      patientId,
      mood: result.mood,
      moodConfidence: result.moodConfidence,
      moodScores: result.moodScores,
      topk: result.topk,
      arousal: result.arousal,
      arousalConfidence: result.arousalConfidence,
      arousalScores: result.arousalScores,
      arousalFromMood: result.arousalFromMood,
      abstained: result.abstained,
      note: result.note ?? null,
      temperature: result.temperature,
      durationSec: result.durationSec,
      scheduledTime,
      triggeredAt: new Date(),
      source: 'voice_ai_checkin',
    });
    console.log(`${LOG} STEP C — saved _id=${aiMood._id} mood=${aiMood.mood} arousal=${aiMood.arousal} abnormal=${aiMood.isAbnormal}`);
  } catch (err) {
    console.error(`${LOG} STEP C ERROR — MongoDB save failed:`, err.message);
    return res.status(500).json({ success: false, message: `Failed to save mood result: ${err.message}` });
  }

  // ── STEP D: abnormal-mood notification (non-fatal) ──
  if (aiMood.isAbnormal) {
    try {
      const patient = await Patient.findById(patientId).select('firstName lastName doctor family');
      if (patient) {
        const recipients = [];
        if (patient.doctor) recipients.push({ id: patient.doctor, model: 'Doctor' });
        if (patient.family) recipients.push({ id: patient.family, model: 'Family' });
        await Promise.all(
          recipients.map((r) => Notification.createAbnormalAiMoodAlert(r.id, r.model, patient, aiMood))
        );
        console.log(`${LOG} STEP D — abnormal notification sent to ${recipients.length} recipient(s)`);
      }
    } catch (err) {
      console.error(`${LOG} STEP D WARNING — notification failed:`, err.message);
    }
  }

  // ── STEP E: real-time emit ──
  try {
    emitToPatientRoom(patientId, 'mood:updated', { mood: aiMood.toObject() });
  } catch (err) {
    console.error(`${LOG} STEP E WARNING — socket emit failed:`, err.message);
  }

  // ── STEP F: respond ──
  console.log(`${LOG} STEP F — SUCCESS total=${Date.now() - t0}ms`);
  return res.status(201).json({
    success: true,
    message: `Mood detected: ${aiMood.mood} (arousal ${aiMood.arousal})`,
    data: aiMood,
  });
};
