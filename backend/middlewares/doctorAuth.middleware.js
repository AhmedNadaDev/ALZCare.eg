import jwt from 'jsonwebtoken';
import Doctor from '../models/Doctor.model.js';

const getJwtSecret = () => process.env.JWT_SECRET;

/**
 * Doctor Authentication Middleware
 * This is completely separate from any existing auth system
 * Uses its own JWT secret and validates only doctor tokens
 */
export const protectDoctor = async (req, res, next) => {
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
      // Verify token using DOCTOR-specific secret
      const decoded = jwt.verify(token, getJwtSecret());

      // Check if token is for a doctor
      if (decoded.role !== 'doctor') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Doctor authentication required.'
        });
      }

      // Get doctor from database
      const doctor = await Doctor.findById(decoded.id).select('-password');

      if (!doctor) {
        return res.status(401).json({
          success: false,
          message: 'Doctor not found. Token may be invalid.'
        });
      }

      if (!doctor.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }

      // Attach doctor to request object
      req.doctor = doctor;
      req.user = doctor; // Also set as user for compatibility
      req.userRole = 'doctor';

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
    console.error('Doctor Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

/**
 * Generate JWT token for Doctor
 */
export const generateDoctorToken = (doctor) => {
  return jwt.sign(
    {
      id: doctor._id,
      email: doctor.email,
      role: 'doctor'
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

/**
 * Optional doctor auth - allows both authenticated and unauthenticated access
 */
export const optionalDoctorAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded.role === 'doctor') {
          const doctor = await Doctor.findById(decoded.id).select('-password');
          if (doctor && doctor.isActive) {
            req.doctor = doctor;
            req.user = doctor;
            req.userRole = 'doctor';
          }
        }
      } catch (err) {
        // Token invalid, but we continue without authentication
      }
    }
    next();
  } catch (error) {
    next();
  }
};

export default { protectDoctor, generateDoctorToken, optionalDoctorAuth };
