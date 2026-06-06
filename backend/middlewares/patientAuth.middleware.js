import jwt from 'jsonwebtoken';
import Patient from '../models/Patient.model.js';

const getJwtSecret = () => process.env.JWT_SECRET;

/**
 * Patient Authentication Middleware
 * Validates JWT tokens that carry role === 'patient'
 */
export const protectPatient = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token has expired. Please login again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token. Please login again.' });
    }

    if (decoded.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Patient authentication required.',
      });
    }

    const patient = await Patient.findById(decoded.id).select('-password');

    if (!patient) {
      return res.status(401).json({ success: false, message: 'Patient not found. Token may be invalid.' });
    }

    if (!patient.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    req.patient = patient;
    req.user = patient;
    req.userRole = 'patient';
    next();
  } catch (error) {
    console.error('Patient Auth Middleware Error:', error);
    return res.status(500).json({ success: false, message: 'Authentication error. Please try again.' });
  }
};

export default { protectPatient };
