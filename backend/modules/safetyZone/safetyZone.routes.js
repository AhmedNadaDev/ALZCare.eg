import express from 'express';
import safetyZoneController from './safetyZone.controller.js';
import { protectFamily } from '../../middlewares/familyAuth.middleware.js';

const router = express.Router();

// All routes require family authentication
router.use(protectFamily);

router.post('/', safetyZoneController.upsertZone);
router.get('/:patientId', safetyZoneController.getZone);

export default router;
