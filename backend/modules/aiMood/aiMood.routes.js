/**
 * aiMood.routes.js  — All routes mounted at /api/mood-checkin
 *
 * Auth:
 *   protectDoctorOrFamily — management / read routes (family + doctor)
 *   protectPatient        — patient audio-upload route
 *
 * Audio upload:
 *   multer memoryStorage so the buffer goes straight to the emotion service
 *   without touching the local filesystem.
 *   Accepts any audio MIME type or extension (browser format varies by OS).
 */

import { Router } from 'express';
import multer from 'multer';
import { protectDoctorOrFamily } from '../../middlewares/familyAuth.middleware.js';
import { protectPatient } from '../../middlewares/patientAuth.middleware.js';
import * as ctrl from './aiMood.controller.js';

const router = Router();

// ── Audio multer — in-memory, up to 25 MB ────────────────────────────────────
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const name = (file.originalname || '').toLowerCase();
    // Accept any audio/* MIME or common audio extensions
    const ok =
      mime.startsWith('audio/') ||
      mime === 'application/octet-stream' || // some browsers send this
      /\.(webm|wav|ogg|mp4|m4a|mp3|aac|flac)$/.test(name);
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: mime="${file.mimetype}" name="${file.originalname}"`), false);
    }
  },
});

// ── Ops / debug ───────────────────────────────────────────────────────────────
/** GET /service-status — check Python service health (doctor/family only) */
router.get('/service-status', protectDoctorOrFamily, ctrl.getServiceStatus);

// ── Family / Doctor management routes ────────────────────────────────────────
router.post('/schedule',           protectDoctorOrFamily, ctrl.setSchedule);
router.get('/schedule/:patientId', protectDoctorOrFamily, ctrl.getSchedule);
router.get('/history/:patientId',  protectDoctorOrFamily, ctrl.getHistory);
router.get('/latest/:patientId',   protectDoctorOrFamily, ctrl.getLatest);
router.get('/stats/:patientId',    protectDoctorOrFamily, ctrl.getStats);

// ── Patient audio upload ──────────────────────────────────────────────────────
router.post(
  '/analyze',
  protectPatient,
  // Run multer, then convert its errors to a structured JSON response before
  // the controller runs. Without this, multer errors become unhandled Express
  // 500s with no useful message in the body.
  (req, res, next) => {
    audioUpload.single('audio')(req, res, (multerErr) => {
      if (!multerErr) {
        if (req.file) {
          console.log(
            `[aiMoodRoutes] multer OK: field="${req.file.fieldname}" ` +
            `name="${req.file.originalname}" size=${req.file.size}B ` +
            `mime="${req.file.mimetype}"`
          );
        } else {
          console.warn('[aiMoodRoutes] multer: no file in request — req.file is undefined');
        }
        return next();
      }

      // multerErr.code is set by multer for known failure types
      console.error('[aiMoodRoutes] multer error:', multerErr.code, multerErr.message);

      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'Audio file is too large. Maximum allowed size is 25 MB.',
        });
      }
      if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: `Unexpected file field. Use field name "audio". Got: "${multerErr.field}"`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Audio upload failed: ${multerErr.message}`,
      });
    });
  },
  ctrl.analyzeAndSave
);

export default router;
