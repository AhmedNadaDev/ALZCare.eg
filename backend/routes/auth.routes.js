import express from 'express';
import authController from '../controllers/auth.controller.js';
import { validateUnifiedLogin } from '../middlewares/validation.middleware.js';
import { protectDoctorOrFamily } from '../middlewares/familyAuth.middleware.js';

const router = express.Router();

router.post('/login', validateUnifiedLogin, authController.login);
router.get('/verify', protectDoctorOrFamily, authController.verifyToken);

export default router;
