import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Middleware to parse FormData nested objects
 * Converts JSON strings to objects before validation
 */
export const parseFormDataObjects = (req, res, next) => {
  // Parse family object if it's a JSON string
  if (req.body.family && typeof req.body.family === 'string') {
    try {
      req.body.family = JSON.parse(req.body.family);
    } catch (e) {
      // If parsing fails, try to parse individual fields
      // FormData might send family fields as family[firstName], etc.
    }
  }
  
  // Convert age to number if it's a string
  if (req.body.age && typeof req.body.age === 'string') {
    req.body.age = parseInt(req.body.age);
  }
  
  next();
};

/**
 * Doctor Signup Validation
 */
export const validateDoctorSignup = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('licenseNumber')
    .trim()
    .notEmpty().withMessage('Medical license number is required'),
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Specialization cannot exceed 100 characters'),
  body('hospital')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Hospital name cannot exceed 200 characters'),
  handleValidationErrors
];

/**
 * Doctor Login Validation
 */
export const validateDoctorLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

/**
 * Family Login Validation
 */
export const validateFamilyLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

/**
 * Patient Creation Validation
 */
export const validatePatientCreate = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('Patient first name is required')
    .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Patient last name is required')
    .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
  body('dateOfBirth')
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Please enter a valid date'),
  body('age')
    .notEmpty().withMessage('Age is required')
    .isInt({ min: 0, max: 150 }).withMessage('Age must be between 0 and 150'),
  body('gender')
    .notEmpty().withMessage('Gender is required')
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('alzheimerLevel')
    .notEmpty().withMessage('Alzheimer level is required')
    .isIn(['early', 'middle', 'late']).withMessage('Alzheimer level must be early, middle, or late'),
  body('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  // Family account validation (mandatory when creating patient)
  body('family.firstName')
    .trim()
    .notEmpty().withMessage('Family member first name is required'),
  body('family.lastName')
    .trim()
    .notEmpty().withMessage('Family member last name is required'),
  body('family.email')
    .trim()
    .notEmpty().withMessage('Family member email is required')
    .isEmail().withMessage('Please enter a valid family member email')
    .normalizeEmail(),
  body('family.password')
    .notEmpty().withMessage('Family member password is required')
    .isLength({ min: 8 }).withMessage('Family password must be at least 8 characters'),
  body('family.relationship')
    .notEmpty().withMessage('Relationship to patient is required')
    .isIn(['spouse', 'child', 'parent', 'sibling', 'grandchild', 'caregiver', 'other'])
    .withMessage('Invalid relationship type'),
  handleValidationErrors
];

/**
 * Patient Update Validation
 */
export const validatePatientUpdate = [
  param('id')
    .isMongoId().withMessage('Invalid patient ID'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
  body('alzheimerLevel')
    .optional()
    .isIn(['early', 'middle', 'late']).withMessage('Alzheimer level must be early, middle, or late'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'discharged', 'deceased']).withMessage('Invalid status'),
  handleValidationErrors
];

/**
 * Medication Creation Validation
 */
export const validateMedicationCreate = [
  body('patientId')
    .notEmpty().withMessage('Patient ID is required')
    .isMongoId().withMessage('Invalid patient ID'),
  body('name')
    .trim()
    .notEmpty().withMessage('Medication name is required')
    .isLength({ max: 200 }).withMessage('Medication name cannot exceed 200 characters'),
  body('type')
    .optional()
    .isIn(['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops', 'other'])
    .withMessage('Invalid medication type'),
  body('schedule')
    .isArray({ min: 1 }).withMessage('At least one schedule is required'),
  body('schedule.*.time')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('schedule.*.days')
    .isArray({ min: 1 }).withMessage('At least one day is required'),
  body('schedule.*.dosage')
    .notEmpty().withMessage('Dosage is required'),
  body('startDate')
    .optional()
    .isISO8601().withMessage('Please enter a valid start date'),
  handleValidationErrors
];

/**
 * Mood Entry Validation
 */
export const validateMoodCreate = [
  body('patientId')
    .notEmpty().withMessage('Patient ID is required')
    .isMongoId().withMessage('Invalid patient ID'),
  body('mood')
    .notEmpty().withMessage('Mood is required')
    .isIn(['very_happy', 'happy', 'neutral', 'sad', 'very_sad', 'anxious', 'confused', 'agitated', 'calm', 'sleepy'])
    .withMessage('Invalid mood value'),
  body('moodScore')
    .notEmpty().withMessage('Mood score is required')
    .isInt({ min: 1, max: 10 }).withMessage('Mood score must be between 1 and 10'),
  body('energy')
    .optional()
    .isIn(['very_low', 'low', 'moderate', 'high', 'very_high']).withMessage('Invalid energy level'),
  body('notes')
    .optional()
    .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),
  handleValidationErrors
];

/**
 * MongoDB ID Validation
 */
export const validateMongoId = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors
];

export default {
  handleValidationErrors,
  parseFormDataObjects,
  validateDoctorSignup,
  validateDoctorLogin,
  validateFamilyLogin,
  validatePatientCreate,
  validatePatientUpdate,
  validateMedicationCreate,
  validateMoodCreate,
  validateMongoId
};
