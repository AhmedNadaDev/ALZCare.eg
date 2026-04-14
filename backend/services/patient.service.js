import Patient from '../models/Patient.model.js';
import Doctor from '../models/Doctor.model.js';
import Family from '../models/Family.model.js';
import Notification from '../models/Notification.model.js';
import User from '../models/User.model.js';
import familyAuthService from './familyAuth.service.js';

class PatientService {
  /**
   * Create new patient with family account
   */
  async createPatient(patientData, familyData, doctorId) {
    const normalizedPatientEmail = String(patientData.email || '').toLowerCase().trim();
    const existingPatientEmail = await Patient.findOne({ email: normalizedPatientEmail });
    if (existingPatientEmail) {
      throw { status: 400, message: 'A patient with this email already exists' };
    }

    // Generate patient number
    const count = await Patient.countDocuments();
    const patientNumber = `ALZ-${String(count + 1).padStart(6, '0')}`;

    // Create patient
    const patient = await Patient.create({
      patientNumber,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      email: normalizedPatientEmail,
      password: patientData.password,
      dateOfBirth: patientData.dateOfBirth,
      age: patientData.age,
      gender: patientData.gender,
      alzheimerLevel: patientData.alzheimerLevel,
      diagnosisDate: patientData.diagnosisDate || new Date(),
      description: patientData.description,
      medicalHistory: patientData.medicalHistory,
      allergies: patientData.allergies || [],
      emergencyContact: patientData.emergencyContact,
      profileImage: patientData.profileImage,
      address: patientData.address,
      doctor: doctorId
    });

    await User.create({
      email: normalizedPatientEmail,
      password: patientData.password,
      role: 'patient',
      patient: patient._id,
      isActive: patient.isActive
    });

    // Create family account (mandatory)
    const family = await familyAuthService.createFamilyAccount({
      ...familyData,
      patientId: patient._id
    }, doctorId);

    // Link patient to doctor's patient list
    await Doctor.findByIdAndUpdate(doctorId, {
      $push: { patients: patient._id }
    });

    // Create notification for doctor
    await Notification.create({
      recipient: doctorId,
      recipientModel: 'Doctor',
      patient: patient._id,
      type: 'new_patient',
      priority: 'medium',
      title: 'New Patient Added',
      message: `Patient ${patient.fullName} (${patientNumber}) has been added to your care.`,
      data: {
        patientId: patient._id,
        patientName: patient.fullName,
        alzheimerLevel: patient.alzheimerLevel
      }
    });

    return {
      patient: await Patient.findById(patient._id).populate('family', 'firstName lastName email phone relationship'),
      familyAccount: family
    };
  }

  /**
   * Get all patients for a doctor
   */
  async getDoctorPatients(doctorId, filters = {}) {
    const query = { doctor: doctorId };

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.alzheimerLevel) {
      query.alzheimerLevel = filters.alzheimerLevel;
    }
    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { patientNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const patients = await Patient.find(query)
      .populate('family', 'firstName lastName email phone relationship')
      .sort({ createdAt: -1 });

    return patients;
  }

  /**
   * Get patient by ID
   */
  async getPatientById(patientId, userId, userRole) {
    const patient = await Patient.findById(patientId)
      .populate('doctor', 'firstName lastName email phone specialization hospital')
      .populate('family', 'firstName lastName email phone relationship');

    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    // Check authorization
    if (userRole === 'doctor' && patient.doctor._id.toString() !== userId.toString()) {
      throw { status: 403, message: 'You are not authorized to view this patient' };
    }

    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== patientId.toString()) {
        throw { status: 403, message: 'You are not authorized to view this patient' };
      }
    }

    if (userRole === 'patient' && patient._id.toString() !== userId.toString()) {
      throw { status: 403, message: 'You are not authorized to view this patient' };
    }

    return patient;
  }

  /**
   * Update patient
   */
  async updatePatient(patientId, updateData, doctorId) {
    // Verify doctor owns this patient
    const patient = await Patient.findOne({ _id: patientId, doctor: doctorId });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    // Restricted fields that cannot be updated
    const restrictedFields = ['patientNumber', 'doctor', 'family'];
    restrictedFields.forEach(field => delete updateData[field]);

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('family', 'firstName lastName email phone relationship');

    // Notify family if Alzheimer level changed
    if (updateData.alzheimerLevel && updateData.alzheimerLevel !== patient.alzheimerLevel) {
      const family = await Family.findOne({ patient: patientId });
      if (family) {
        await Notification.create({
          recipient: family._id,
          recipientModel: 'Family',
          patient: patientId,
          type: 'patient_update',
          priority: 'high',
          title: 'Patient Condition Updated',
          message: `${patient.firstName}'s Alzheimer's level has been updated to ${updateData.alzheimerLevel} stage.`,
          data: {
            previousLevel: patient.alzheimerLevel,
            newLevel: updateData.alzheimerLevel
          }
        });
      }
    }

    return updatedPatient;
  }

  /**
   * Add note to patient
   */
  async addPatientNote(patientId, noteContent, doctorId) {
    const patient = await Patient.findOne({ _id: patientId, doctor: doctorId });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    patient.notes.push({
      content: noteContent,
      createdBy: doctorId,
      createdAt: new Date()
    });

    await patient.save();

    return patient;
  }

  /**
   * Get patient notes
   */
  async getPatientNotes(patientId, userId, userRole) {
    const patient = await Patient.findById(patientId)
      .populate('notes.createdBy', 'firstName lastName');

    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    // Check authorization
    if (userRole === 'doctor' && patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'You are not authorized to view this patient' };
    }

    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== patientId.toString()) {
        throw { status: 403, message: 'You are not authorized to view this patient notes' };
      }
    }

    if (userRole === 'patient' && patient._id.toString() !== userId.toString()) {
      throw { status: 403, message: 'You are not authorized to view this patient notes' };
    }

    return patient.notes.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Update patient status
   */
  async updatePatientStatus(patientId, status, doctorId) {
    const patient = await Patient.findOne({ _id: patientId, doctor: doctorId });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    patient.status = status;
    await patient.save();

    // Notify family about status change
    if (patient.family) {
      await Notification.create({
        recipient: patient.family,
        recipientModel: 'Family',
        patient: patientId,
        type: 'patient_update',
        priority: status === 'discharged' || status === 'deceased' ? 'urgent' : 'medium',
        title: 'Patient Status Updated',
        message: `${patient.firstName}'s status has been changed to ${status}.`,
        data: { status }
      });
    }

    return patient;
  }

  /**
   * Schedule next appointment
   */
  async scheduleAppointment(patientId, appointmentDate, doctorId) {
    const patient = await Patient.findOne({ _id: patientId, doctor: doctorId });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    patient.nextAppointment = new Date(appointmentDate);
    await patient.save();

    // Notify family
    if (patient.family) {
      await Notification.create({
        recipient: patient.family,
        recipientModel: 'Family',
        patient: patientId,
        type: 'appointment_reminder',
        priority: 'medium',
        title: 'Appointment Scheduled',
        message: `An appointment has been scheduled for ${patient.firstName} on ${new Date(appointmentDate).toLocaleDateString()}.`,
        data: { appointmentDate }
      });
    }

    return patient;
  }

  /**
   * Get patient statistics
   */
  async getPatientStats(patientId, userId, userRole) {
    const Medication = (await import('../models/Medication.model.js')).default;
    const Mood = (await import('../models/Mood.model.js')).default;

    const patient = await this.getPatientById(patientId, userId, userRole);

    // Get medication stats
    const medications = await Medication.find({ patient: patientId, isActive: true });
    const totalMedications = medications.length;
    
    // Calculate adherence rate (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let totalScheduled = 0;
    let totalTaken = 0;
    
    medications.forEach(med => {
      med.medicationLogs.forEach(log => {
        if (new Date(log.scheduledDate) >= sevenDaysAgo) {
          totalScheduled++;
          if (log.status === 'taken') totalTaken++;
        }
      });
    });

    const adherenceRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 100;

    // Get mood stats
    const moodStats = await Mood.getMoodStats(patientId, 30);

    return {
      patient: {
        id: patient._id,
        name: patient.fullName,
        alzheimerLevel: patient.alzheimerLevel,
        status: patient.status
      },
      medications: {
        total: totalMedications,
        adherenceRate
      },
      mood: moodStats || {
        totalEntries: 0,
        averageScore: 0,
        abnormalCount: 0,
        abnormalPercentage: 0
      }
    };
  }

  /**
   * Delete patient
   */
  async deletePatient(patientId, doctorId) {
    const patient = await Patient.findById(patientId);
    
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    if (patient.doctor.toString() !== doctorId.toString()) {
      throw { status: 403, message: 'Not authorized to delete this patient' };
    }

    // Remove from doctor's patient list
    await Doctor.findByIdAndUpdate(doctorId, {
      $pull: { patients: patientId }
    });

    // Delete associated family account if exists
    if (patient.family) {
      await Family.findByIdAndDelete(patient.family);
    }

    // Delete patient
    await Patient.findByIdAndDelete(patientId);

    return { message: 'Patient deleted successfully' };
  }
}

export default new PatientService();
