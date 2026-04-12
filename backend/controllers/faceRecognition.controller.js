import faceRecognitionService from '../services/faceRecognition.service.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: parseInt(process.env.MAX_IMAGE_COUNT || '20', 10),
  },
});

class FaceRecognitionController {
  /**
   * @route   POST /api/family/face-recognition/register
   * @desc    Register a person with face images
   * @access  Private (Family)
   */
  async registerPerson(req, res, next) {
    try {
      const familyId = req.family._id;
      const patientId = req.family.patient?._id || null;
      const { name, age, relation } = req.body;

      if (!req.files || !req.files.length) {
        return res.status(400).json({
          success: false,
          error: 'At least one image is required',
        });
      }

      const images = req.files.map((f) => f.buffer);

      const result = await faceRecognitionService.registerPerson(
        { name, age, relation, images },
        familyId,
        patientId
      );

      res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/family/face-recognition/recognize
   * @desc    Recognize faces in an image
   * @access  Private (Family)
   */
  async recognizeFace(req, res, next) {
    try {
      const familyId = req.family._id;
      const { image } = req.body;

      const result = await faceRecognitionService.recognizeFace(image, familyId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/face-recognition/patient/recognize
   * @desc    Recognize faces in an image (public, no auth)
   * @access  Public
   */
  async recognizeFacePublic(req, res, next) {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({
          success: false,
          message: 'Image is required'
        });
      }

      // Use a single lightweight model for faster public recognition
      const result = await faceRecognitionService.recognizeFace(image, null, 'buffalo_l');

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/family/face-recognition/persons
   * @desc    Get all registered persons for a family
   * @access  Private (Family)
   */
  async getRegisteredPersons(req, res, next) {
    try {
      const familyId = req.family._id;
      const persons = await faceRecognitionService.getRegisteredPersons(familyId);

      res.status(200).json({
        success: true,
        data: persons,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export upload middleware and controller
export const uploadMiddleware = upload.array('images', parseInt(process.env.MAX_IMAGE_COUNT || '20', 10));
export default new FaceRecognitionController();
