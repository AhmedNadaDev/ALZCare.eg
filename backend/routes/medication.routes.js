import express from 'express';
import medicationController from '../controllers/medication.controller.js';
import { protectDoctor } from '../middlewares/doctorAuth.middleware.js';
import { protectDoctorOrFamily } from '../middlewares/familyAuth.middleware.js';
import { validateMedicationCreate } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Doctor-only routes
router.post('/', protectDoctor, validateMedicationCreate, medicationController.createMedication);
router.put('/:id', protectDoctor, medicationController.updateMedication);
router.put('/:id/discontinue', protectDoctor, medicationController.discontinueMedication);
router.delete('/:id', protectDoctor, medicationController.deleteMedication);

// Routes accessible by both doctor and family
router.get('/patient/:patientId', protectDoctorOrFamily, medicationController.getPatientMedications);
router.get('/patient/:patientId/today', protectDoctorOrFamily, medicationController.getTodaySchedule);
router.get('/patient/:patientId/adherence', protectDoctorOrFamily, medicationController.getAdherenceStats);
router.get('/:id', protectDoctorOrFamily, medicationController.getMedication);
router.post('/:id/log', protectDoctorOrFamily, medicationController.logMedication);

export default router;
