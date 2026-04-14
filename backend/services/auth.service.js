import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import Family from '../models/Family.model.js';
import Patient from '../models/Patient.model.js';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET;

const generateAuthToken = (payload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

class AuthService {
  async login(email, password, role) {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const userRole = String(role || '').toLowerCase().trim();

    if (!['doctor', 'family', 'patient'].includes(userRole)) {
      throw { status: 400, message: 'Invalid role' };
    }

    const user = await User.findOne({ email: normalizedEmail, role: userRole }).select('+password');
    if (!user) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    if (!user.isActive) {
      throw { status: 403, message: 'Your account has been deactivated. Please contact support.' };
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    const now = new Date();
    user.lastLogin = now;
    await user.save();

    if (userRole === 'doctor') {
      const doctor = await Doctor.findOne({ email: normalizedEmail }).select('-password');
      if (!doctor || !doctor.isActive) {
        throw { status: 403, message: 'Doctor account is unavailable.' };
      }
      doctor.lastLogin = now;
      await doctor.save();
      return {
        token: generateAuthToken({ id: doctor._id, email: doctor.email, role: 'doctor' }),
        role: 'doctor',
        doctor
      };
    }

    if (userRole === 'family') {
      const family = await Family.findOne({ email: normalizedEmail })
        .select('-password')
        .populate('patient', 'firstName lastName patientNumber alzheimerLevel status profileImage');
      if (!family || !family.isActive) {
        throw { status: 403, message: 'Family account is unavailable.' };
      }
      family.lastLogin = now;
      await family.save();
      return {
        token: generateAuthToken({ id: family._id, email: family.email, role: 'family', patientId: family.patient?._id }),
        role: 'family',
        family
      };
    }

    const patient = await Patient.findOne({ email: normalizedEmail }).select('-password');
    if (!patient || !patient.isActive) {
      throw { status: 403, message: 'Patient account is unavailable.' };
    }
    patient.lastLogin = now;
    await patient.save();
    return {
      token: generateAuthToken({ id: patient._id, email: patient.email, role: 'patient' }),
      role: 'patient',
      patient
    };
  }
}

export default new AuthService();
