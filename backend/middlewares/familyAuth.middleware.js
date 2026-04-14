import jwt from 'jsonwebtoken';
import Family from '../models/Family.model.js';
import Patient from '../models/Patient.model.js';
const getJwtSecret = () => process.env.JWT_SECRET;

/**
 * Family Authentication Middleware
 * This is completely separate from any existing auth system
 * Uses its own JWT secret and validates only family tokens
 */
export const protectFamily = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    try {
      // Verify token using FAMILY-specific secret
      const decoded = jwt.verify(token, getJwtSecret());

      // Check if token is for a family member
      if (decoded.role !== 'family') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Family authentication required.'
        });
      }

      // Get family member from database
      const family = await Family.findById(decoded.id)
        .select('-password')
        .populate('patient', 'firstName lastName patientNumber alzheimerLevel status');

      if (!family) {
        return res.status(401).json({
          success: false,
          message: 'Family member not found. Token may be invalid.'
        });
      }

      if (!family.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact your doctor.'
        });
      }

      // Attach family member to request object
      req.family = family;
      req.user = family;
      req.userRole = 'family';
      req.patientId = family.patient._id;

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.'
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.'
        });
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('Family Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

/**
 * Generate JWT token for Family Member
 */
export const generateFamilyToken = (family) => {
  return jwt.sign(
    {
      id: family._id,
      email: family.email,
      role: 'family',
      patientId: family.patient
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

/**
 * Check family permission middleware
 */
export const checkFamilyPermission = (permission) => {
  return (req, res, next) => {
    if (!req.family) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!req.family.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to ${permission.replace(/([A-Z])/g, ' $1').toLowerCase()}.`
      });
    }

    next();
  };
};

/**
 * Combined auth middleware - allows both doctor and family
 */
export const protectDoctorOrFamily = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    // Try doctor token first
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded.role === 'doctor') {
        const Doctor = (await import('../models/Doctor.model.js')).default;
        const doctor = await Doctor.findById(decoded.id).select('-password');
        if (doctor && doctor.isActive) {
          req.doctor = doctor;
          req.user = doctor;
          req.userRole = 'doctor';
          return next();
        }
      }
    } catch (err) {
      // Not a valid doctor token, try family token
    }

    // Try family token
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded.role === 'family') {
        const family = await Family.findById(decoded.id)
          .select('-password')
          .populate('patient', 'firstName lastName patientNumber alzheimerLevel status');
        if (family && family.isActive) {
          req.family = family;
          req.user = family;
          req.userRole = 'family';
          req.patientId = family.patient._id;
          return next();
        }
      }
    } catch (err) {
      // Not a valid family token either
    }

    // Try patient token
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded.role === 'patient') {
        const patient = await Patient.findById(decoded.id).select('-password');
        if (patient && patient.isActive) {
          req.patient = patient;
          req.user = patient;
          req.userRole = 'patient';
          req.patientId = patient._id;
          return next();
        }
      }
    } catch (err) {
      // Not a valid patient token either
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please login again.'
    });
  } catch (error) {
    console.error('Combined Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

export default { protectFamily, generateFamilyToken, checkFamilyPermission, protectDoctorOrFamily };
