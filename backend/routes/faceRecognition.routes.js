import express from 'express';
import faceRecognitionController, { uploadMiddleware } from '../controllers/faceRecognition.controller.js';
import { protectFamily } from '../middlewares/familyAuth.middleware.js';

const router = express.Router();

// Family routes (protected)
router.post(
  '/register',
  protectFamily,
  uploadMiddleware,
  faceRecognitionController.registerPerson
);

router.post(
  '/recognize',
  protectFamily,
  faceRecognitionController.recognizeFace
);

router.get(
  '/persons',
  protectFamily,
  faceRecognitionController.getRegisteredPersons
);

// Public patient router (no auth)
const publicRouter = express.Router();
publicRouter.post(
  '/patient/recognize',
  faceRecognitionController.recognizeFacePublic
);

export default router;
export { publicRouter as faceRecognitionPublicRoutes };
