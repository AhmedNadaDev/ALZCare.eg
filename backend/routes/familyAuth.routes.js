import express from 'express';
import familyAuthController from '../controllers/familyAuth.controller.js';
import { protectFamily } from '../middlewares/familyAuth.middleware.js';
import { validateFamilyLogin } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Public routes
// Note: Family signup is NOT public - accounts are created by doctors
router.post('/login', validateFamilyLogin, familyAuthController.login);

// Protected routes (require family authentication)
router.get('/profile', protectFamily, familyAuthController.getProfile);
router.put('/profile', protectFamily, familyAuthController.updateProfile);
router.put('/change-password', protectFamily, familyAuthController.changePassword);
router.get('/verify', protectFamily, familyAuthController.verifyToken);

export default router;
