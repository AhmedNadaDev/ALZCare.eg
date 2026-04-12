export { protectDoctor, generateDoctorToken, optionalDoctorAuth } from './doctorAuth.middleware.js';
export { protectFamily, generateFamilyToken, checkFamilyPermission, protectDoctorOrFamily } from './familyAuth.middleware.js';
export { 
  handleValidationErrors,
  validateDoctorSignup,
  validateDoctorLogin,
  validateFamilyLogin,
  validatePatientCreate,
  validatePatientUpdate,
  validateMedicationCreate,
  validateMoodCreate,
  validateMongoId
} from './validation.middleware.js';
export { uploadSingleImage, uploadMultipleImages, getFileUrl, deleteFile } from './upload.middleware.js';
