import { Router } from 'express';
import { protectDoctorOrFamily } from '../../../middlewares/familyAuth.middleware.js';
import { uploadAlbumCover, uploadMemoryMedia } from '../../../middlewares/uploadMedia.middleware.js';
import albumCtrl from '../controllers/memoryAlbum.controller.js';
import exerciseCtrl from '../controllers/exercise.controller.js';
import scheduleCtrl from '../controllers/cognitiveSchedule.controller.js';
import sessionCtrl from '../controllers/cognitiveSession.controller.js';
import analyticsCtrl from '../controllers/cognitiveAnalytics.controller.js';

/**
 * Cognitive (Memory Assistant) module router — mounted at /api/cognitive.
 *
 * Every route requires authentication. protectDoctorOrFamily accepts doctor,
 * family AND patient tokens; per-patient ownership is enforced inside each
 * service via assertPatientAccess.
 *
 * Patient-scoped reads/creates take :patientId in the path; family/patient
 * tokens may omit it (it resolves to their own linked patient).
 */
const router = Router();
router.use(protectDoctorOrFamily);

// ── Exercise template catalogue ─────────────────────────────────────────────
router.get('/exercise-templates', exerciseCtrl.listTemplates.bind(exerciseCtrl));

// ── Memory albums & items ───────────────────────────────────────────────────
router.get('/patients/:patientId/albums', albumCtrl.list.bind(albumCtrl));
router.post('/patients/:patientId/albums', uploadAlbumCover, albumCtrl.create.bind(albumCtrl));
router.get('/albums/:albumId', albumCtrl.get.bind(albumCtrl));
router.put('/albums/:albumId', uploadAlbumCover, albumCtrl.update.bind(albumCtrl));
router.delete('/albums/:albumId', albumCtrl.remove.bind(albumCtrl));
router.post('/albums/:albumId/items', uploadMemoryMedia, albumCtrl.addItem.bind(albumCtrl));
router.put('/albums/:albumId/reorder', albumCtrl.reorder.bind(albumCtrl));
router.post('/albums/:albumId/view', albumCtrl.logView.bind(albumCtrl));
router.put('/items/:itemId', uploadMemoryMedia, albumCtrl.updateItem.bind(albumCtrl));
router.delete('/items/:itemId', albumCtrl.removeItem.bind(albumCtrl));

// ── Cognitive assignments (PatientAssignments) ──────────────────────────────
router.get('/patients/:patientId/assignments', exerciseCtrl.listAssignments.bind(exerciseCtrl));
router.post('/patients/:patientId/assignments/exercise', exerciseCtrl.createExercise.bind(exerciseCtrl));
router.post('/patients/:patientId/assignments/album', exerciseCtrl.createAlbum.bind(exerciseCtrl));
router.put('/assignments/:assignmentId', exerciseCtrl.update.bind(exerciseCtrl));
router.put('/assignments/:assignmentId/enabled', exerciseCtrl.setEnabled.bind(exerciseCtrl));
router.delete('/assignments/:assignmentId', exerciseCtrl.remove.bind(exerciseCtrl));

// ── Schedules ───────────────────────────────────────────────────────────────
router.get('/patients/:patientId/schedules', scheduleCtrl.list.bind(scheduleCtrl));
router.post('/patients/:patientId/schedules', scheduleCtrl.create.bind(scheduleCtrl));
router.put('/schedules/:scheduleId', scheduleCtrl.update.bind(scheduleCtrl));
router.put('/schedules/:scheduleId/active', scheduleCtrl.setActive.bind(scheduleCtrl));
router.delete('/schedules/:scheduleId', scheduleCtrl.remove.bind(scheduleCtrl));

// ── Sessions ────────────────────────────────────────────────────────────────
router.post('/sessions/start', sessionCtrl.start.bind(sessionCtrl));
router.post('/sessions/:sessionId/start', sessionCtrl.startExisting.bind(sessionCtrl));
router.post('/sessions/:sessionId/interactions', sessionCtrl.recordInteraction.bind(sessionCtrl));
router.post('/sessions/:sessionId/complete', sessionCtrl.complete.bind(sessionCtrl));
router.post('/sessions/:sessionId/abandon', sessionCtrl.abandon.bind(sessionCtrl));
router.get('/patients/:patientId/sessions/due', sessionCtrl.due.bind(sessionCtrl));
router.get('/patients/:patientId/sessions', sessionCtrl.history.bind(sessionCtrl));
router.get('/sessions/:sessionId', sessionCtrl.get.bind(sessionCtrl));

// ── Analytics ───────────────────────────────────────────────────────────────
router.get('/patients/:patientId/analytics', analyticsCtrl.overview.bind(analyticsCtrl));

export default router;
