import express from 'express';
import doctorAuthController from '../controllers/doctorAuth.controller.js';
import { protectDoctor } from '../middlewares/doctorAuth.middleware.js';
import { validateDoctorSignup, validateDoctorLogin } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Public routes
router.post('/signup', validateDoctorSignup, doctorAuthController.signup);
router.post('/login', validateDoctorLogin, doctorAuthController.login);

// Protected routes (require doctor authentication)
router.get('/profile', protectDoctor, doctorAuthController.getProfile);
router.put('/profile', protectDoctor, doctorAuthController.updateProfile);
router.put('/change-password', protectDoctor, doctorAuthController.changePassword);
router.get('/stats', protectDoctor, doctorAuthController.getStats);
router.get('/verify', protectDoctor, doctorAuthController.verifyToken);

export default router;
