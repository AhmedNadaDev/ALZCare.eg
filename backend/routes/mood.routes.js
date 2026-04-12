import express from 'express';
import moodController from '../controllers/mood.controller.js';
import { protectDoctor } from '../middlewares/doctorAuth.middleware.js';
import { protectDoctorOrFamily } from '../middlewares/familyAuth.middleware.js';
import { validateMoodCreate } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Routes accessible by both doctor and family
router.post('/', protectDoctorOrFamily, validateMoodCreate, moodController.createMoodEntry);
router.get('/patient/:patientId', protectDoctorOrFamily, moodController.getMoodHistory);
router.get('/patient/:patientId/stats', protectDoctorOrFamily, moodController.getMoodStats);
router.get('/patient/:patientId/abnormal', protectDoctorOrFamily, moodController.getAbnormalMoods);
router.get('/:id', protectDoctorOrFamily, moodController.getMoodEntry);
router.put('/:id', protectDoctorOrFamily, moodController.updateMoodEntry);

// Doctor-only routes
router.delete('/:id', protectDoctorOrFamily, moodController.deleteMoodEntry);

export default router;
