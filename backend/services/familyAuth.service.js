import Family from '../models/Family.model.js';
import Patient from '../models/Patient.model.js';
import User from '../models/User.model.js';
import { generateFamilyToken } from '../middlewares/familyAuth.middleware.js';

class FamilyAuthService {
  /**
   * Create family account (called by doctor when adding patient)
   * Family accounts are NOT created through public signup
   */
  async createFamilyAccount(familyData, doctorId) {
    // Check if email already exists
    const existingEmail = await Family.findOne({ email: familyData.email });
    if (existingEmail) {
      throw { status: 400, message: 'A family member with this email already exists' };
    }

    // Verify patient exists and belongs to the doctor
    const patient = await Patient.findOne({ 
      _id: familyData.patientId,
      doctor: doctorId
    });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    // Check if patient already has a family account
    if (patient.family) {
      throw { status: 400, message: 'This patient already has a family account assigned' };
    }

    // Create family account
    const family = await Family.create({
      firstName: familyData.firstName,
      lastName: familyData.lastName,
      email: familyData.email,
      password: familyData.password,
      phone: familyData.phone,
      relationship: familyData.relationship,
      patient: familyData.patientId,
      createdBy: doctorId
    });

    await User.create({
      email: family.email,
      password: familyData.password,
      role: 'family',
      family: family._id,
      isActive: family.isActive
    });

    // Link family to patient
    patient.family = family._id;
    await patient.save();

    // Return family without password
    const familyResponse = family.toObject();
    delete familyResponse.password;

    return familyResponse;
  }

  /**
   * Login family member
   */
  async login(email, password) {
    const normalizedEmail = String(email || '').toLowerCase().trim();

    // Find family with password
    const family = await Family.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('patient', 'firstName lastName patientNumber alzheimerLevel status profileImage');

    if (!family) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    if (!family.isActive) {
      throw { status: 403, message: 'Your account has been deactivated. Please contact your doctor.' };
    }

    // Check if associated patient exists and is active
    if (!family.patient) {
      throw { status: 403, message: 'Associated patient not found. Please contact your doctor.' };
    }

    let user = await User.findOne({ email: normalizedEmail, role: 'family' }).select('+password');
    let isMatch = false;

    if (user) {
      isMatch = await user.comparePassword(password);
    } else {
      // Backfill legacy family accounts into unified User auth store
      isMatch = await family.comparePassword(password);
      if (isMatch) {
        user = await User.create({
          email: family.email,
          password,
          role: 'family',
          family: family._id,
          isActive: family.isActive
        });
      }
    }

    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    // Update last login
    const now = new Date();
    family.lastLogin = now;
    await family.save();
    if (user) {
      user.lastLogin = now;
      await user.save();
    }

    // Generate token
    const token = generateFamilyToken(family);

    // Return family without password
    const familyResponse = family.toObject();
    delete familyResponse.password;

    return {
      family: familyResponse,
      token
    };
  }

  /**
   * Get family profile
   */
  async getProfile(familyId) {
    const family = await Family.findById(familyId)
      .populate({
        path: 'patient',
        select: 'firstName lastName patientNumber alzheimerLevel status profileImage dateOfBirth age gender description emergencyContact'
      })
      .populate('createdBy', 'firstName lastName email phone hospital');

    if (!family) {
      throw { status: 404, message: 'Family member not found' };
    }

    return family;
  }

  /**
   * Update family profile
   */
  async updateProfile(familyId, updateData) {
    // Fields that cannot be updated by family
    const restrictedFields = ['password', 'email', 'patient', 'createdBy', 'role', 'isActive', 'permissions'];
    restrictedFields.forEach(field => delete updateData[field]);

    const family = await Family.findByIdAndUpdate(
      familyId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('patient', 'firstName lastName patientNumber alzheimerLevel status');

    if (!family) {
      throw { status: 404, message: 'Family member not found' };
    }

    return family;
  }

  /**
   * Change family password
   */
  async changePassword(familyId, currentPassword, newPassword) {
    const family = await Family.findById(familyId).select('+password');

    if (!family) {
      throw { status: 404, message: 'Family member not found' };
    }

    // Verify current password
    const isMatch = await family.comparePassword(currentPassword);
    if (!isMatch) {
      throw { status: 400, message: 'Current password is incorrect' };
    }

    // Update password
    family.password = newPassword;
    await family.save();

    const authUser = await User.findOne({ email: family.email, role: 'family' }).select('+password');
    if (authUser) {
      authUser.password = newPassword;
      await authUser.save();
    }

    return { message: 'Password updated successfully' };
  }

  /**
   * Get family accounts for a patient (doctor use)
   */
  async getFamilyByPatient(patientId, doctorId) {
    const patient = await Patient.findOne({
      _id: patientId,
      doctor: doctorId
    });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    const family = await Family.findOne({ patient: patientId })
      .select('-password');

    return family;
  }

  /**
   * Deactivate family account (doctor use)
   */
  async deactivateAccount(familyId, doctorId) {
    const family = await Family.findById(familyId);

    if (!family) {
      throw { status: 404, message: 'Family account not found' };
    }

    // Verify the doctor created this account
    if (family.createdBy.toString() !== doctorId.toString()) {
      throw { status: 403, message: 'You are not authorized to deactivate this account' };
    }

    family.isActive = false;
    await family.save();

    return { message: 'Family account deactivated successfully' };
  }

  /**
   * Update family permissions (doctor use)
   */
  async updatePermissions(familyId, permissions, doctorId) {
    const family = await Family.findById(familyId);

    if (!family) {
      throw { status: 404, message: 'Family account not found' };
    }

    // Verify the doctor created this account
    if (family.createdBy.toString() !== doctorId.toString()) {
      throw { status: 403, message: 'You are not authorized to update this account' };
    }

    family.permissions = { ...family.permissions, ...permissions };
    await family.save();

    return family;
  }
}

export default new FamilyAuthService();
