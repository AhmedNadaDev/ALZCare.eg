import express from 'express';
import medicationController from '../controllers/medication.controller.js';
import { protectFamily } from '../middlewares/familyAuth.middleware.js';
import { validateMedicationCreate } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Family-only routes for medication management
router.post('/', protectFamily, validateMedicationCreate, medicationController.addFamilyMedication);
router.delete('/:id', protectFamily, medicationController.deleteFamilyMedication);

export default router;
