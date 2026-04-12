import express from 'express';
import patientController from '../controllers/patient.controller.js';
import familyAuthController from '../controllers/familyAuth.controller.js';
import { protectDoctor } from '../middlewares/doctorAuth.middleware.js';
import { protectDoctorOrFamily } from '../middlewares/familyAuth.middleware.js';
import { validatePatientCreate, validatePatientUpdate, validateMongoId, parseFormDataObjects } from '../middlewares/validation.middleware.js';
import { uploadSingleImage } from '../middlewares/upload.middleware.js';

const router = express.Router();

// Doctor-only routes
router.post('/', 
  protectDoctor, 
  uploadSingleImage('patientImage'),
  parseFormDataObjects,
  validatePatientCreate, 
  patientController.createPatient
);

router.get('/', protectDoctor, patientController.getPatients);

router.put('/:id', 
  protectDoctor, 
  uploadSingleImage('patientImage'),
  validatePatientUpdate, 
  patientController.updatePatient
);

router.put('/:id/status', protectDoctor, patientController.updateStatus);
router.post('/:id/appointment', protectDoctor, patientController.scheduleAppointment);
router.post('/:id/notes', protectDoctor, patientController.addNote);
router.delete('/:id', protectDoctor, patientController.deletePatient);

// Family management (doctor only)
router.get('/:patientId/family', protectDoctor, familyAuthController.getFamilyByPatient);
router.put('/family/:id/deactivate', protectDoctor, familyAuthController.deactivateAccount);
router.put('/family/:id/permissions', protectDoctor, familyAuthController.updatePermissions);

// Routes accessible by both doctor and family
router.get('/:id', protectDoctorOrFamily, patientController.getPatient);
router.get('/:id/notes', protectDoctorOrFamily, patientController.getNotes);
router.get('/:id/stats', protectDoctorOrFamily, patientController.getPatientStats);

export default router;
