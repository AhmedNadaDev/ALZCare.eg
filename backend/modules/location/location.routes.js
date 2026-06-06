import express from 'express';
import locationController from './location.controller.js';
import { protectPatient } from '../../middlewares/patientAuth.middleware.js';
import { protectFamily } from '../../middlewares/familyAuth.middleware.js';

// Patient writes their own location  →  POST /api/patient/location
const patientLocationRouter = express.Router();
patientLocationRouter.post('/', protectPatient, locationController.updateLocation);

// Family reads the linked patient's location  →  GET /api/family/location/:patientId
const familyLocationRouter = express.Router();
familyLocationRouter.get('/:patientId', protectFamily, locationController.getPatientLocation);

export { patientLocationRouter, familyLocationRouter };
