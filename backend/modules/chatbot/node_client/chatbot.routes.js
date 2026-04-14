import express from 'express';
import { protectDoctorOrFamily } from '../../../middlewares/familyAuth.middleware.js';
import { askQuestion } from './chatbot.controller.js';

const router = express.Router();

/**
 * POST /api/chatbot/ask
 * Body: { question: string, patient_id: string }
 * Auth: doctor or family JWT (handled by protectDoctorOrFamily)
 */
router.post('/ask', protectDoctorOrFamily, askQuestion);

export default router;
