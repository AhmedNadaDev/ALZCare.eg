import Doctor from '../models/Doctor.model.js';
import User from '../models/User.model.js';
import { generateDoctorToken } from '../middlewares/doctorAuth.middleware.js';

class DoctorAuthService {
  /**
   * Register a new doctor
   */
  async signup(doctorData) {
    // Check if email already exists
    const existingEmail = await Doctor.findOne({ email: doctorData.email });
    if (existingEmail) {
      throw { status: 400, message: 'A doctor with this email already exists' };
    }

    // Check if license number already exists
    const existingLicense = await Doctor.findOne({ licenseNumber: doctorData.licenseNumber });
    if (existingLicense) {
      throw { status: 400, message: 'A doctor with this license number already exists' };
    }

    // Create new doctor
    const doctor = await Doctor.create({
      firstName: doctorData.firstName,
      lastName: doctorData.lastName,
      email: doctorData.email,
      password: doctorData.password,
      licenseNumber: doctorData.licenseNumber,
      specialization: doctorData.specialization || 'Neurology',
      hospital: doctorData.hospital,
      phone: doctorData.phone
    });

    await User.create({
      email: doctor.email,
      password: doctorData.password,
      role: 'doctor',
      doctor: doctor._id,
      isActive: doctor.isActive
    });

    // Generate token
    const token = generateDoctorToken(doctor);

    // Return doctor without password
    const doctorResponse = doctor.toObject();
    delete doctorResponse.password;

    return {
      doctor: doctorResponse,
      token
    };
  }

  /**
   * Login doctor
   */
  async login(email, password) {
    const normalizedEmail = String(email || '').toLowerCase().trim();

    // Find doctor with password
    const doctor = await Doctor.findOne({ email: normalizedEmail }).select('+password');

    if (!doctor) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    if (!doctor.isActive) {
      throw { status: 403, message: 'Your account has been deactivated. Please contact support.' };
    }

    let user = await User.findOne({ email: normalizedEmail, role: 'doctor' }).select('+password');
    let isMatch = false;

    if (user) {
      isMatch = await user.comparePassword(password);
    } else {
      // Backfill legacy doctor accounts into unified User auth store
      isMatch = await doctor.comparePassword(password);
      if (isMatch) {
        user = await User.create({
          email: doctor.email,
          password,
          role: 'doctor',
          doctor: doctor._id,
          isActive: doctor.isActive
        });
      }
    }

    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    // Update last login
    const now = new Date();
    doctor.lastLogin = now;
    await doctor.save();
    if (user) {
      user.lastLogin = now;
      await user.save();
    }

    // Generate token
    const token = generateDoctorToken(doctor);

    // Return doctor without password
    const doctorResponse = doctor.toObject();
    delete doctorResponse.password;

    return {
      doctor: doctorResponse,
      token
    };
  }

  /**
   * Get doctor profile
   */
  async getProfile(doctorId) {
    const doctor = await Doctor.findById(doctorId)
      .populate('patients', 'firstName lastName patientNumber alzheimerLevel status');

    if (!doctor) {
      throw { status: 404, message: 'Doctor not found' };
    }

    return doctor;
  }

  /**
   * Update doctor profile
   */
  async updateProfile(doctorId, updateData) {
    // Fields that cannot be updated
    const restrictedFields = ['password', 'email', 'licenseNumber', 'role', 'isActive', 'isVerified'];
    restrictedFields.forEach(field => delete updateData[field]);

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      throw { status: 404, message: 'Doctor not found' };
    }

    return doctor;
  }

  /**
   * Change doctor password
   */
  async changePassword(doctorId, currentPassword, newPassword) {
    const doctor = await Doctor.findById(doctorId).select('+password');

    if (!doctor) {
      throw { status: 404, message: 'Doctor not found' };
    }

    // Verify current password
    const isMatch = await doctor.comparePassword(currentPassword);
    if (!isMatch) {
      throw { status: 400, message: 'Current password is incorrect' };
    }

    // Update password
    doctor.password = newPassword;
    await doctor.save();

    const authUser = await User.findOne({ email: doctor.email, role: 'doctor' }).select('+password');
    if (authUser) {
      authUser.password = newPassword;
      await authUser.save();
    }

    return { message: 'Password updated successfully' };
  }

  /**
   * Get doctor statistics
   */
  async getStats(doctorId) {
    const doctor = await Doctor.findById(doctorId).populate('patients');
    
    if (!doctor) {
      throw { status: 404, message: 'Doctor not found' };
    }

    const patients = doctor.patients;
    const activePatients = patients.filter(p => p.status === 'active');

    // Calculate Alzheimer level distribution
    const levelDistribution = {
      early: activePatients.filter(p => p.alzheimerLevel === 'early').length,
      middle: activePatients.filter(p => p.alzheimerLevel === 'middle').length,
      late: activePatients.filter(p => p.alzheimerLevel === 'late').length
    };

    return {
      totalPatients: patients.length,
      activePatients: activePatients.length,
      levelDistribution
    };
  }
}

export default new DoctorAuthService();
