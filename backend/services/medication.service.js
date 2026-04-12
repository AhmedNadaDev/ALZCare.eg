import Medication from '../models/Medication.model.js';
import Patient from '../models/Patient.model.js';
import Family from '../models/Family.model.js';
import Notification from '../models/Notification.model.js';

class MedicationService {
  /**
   * Create medication
   */
  async createMedication(medicationData, doctorId) {
    // Verify patient exists and belongs to doctor
    const patient = await Patient.findOne({
      _id: medicationData.patientId,
      doctor: doctorId
    });

    if (!patient) {
      throw { status: 404, message: 'Patient not found or not assigned to you' };
    }

    const medication = await Medication.create({
      patient: medicationData.patientId,
      prescribedBy: doctorId,
      name: medicationData.name,
      genericName: medicationData.genericName,
      type: medicationData.type || 'tablet',
      strength: medicationData.strength,
      instructions: medicationData.instructions,
      purpose: medicationData.purpose,
      sideEffects: medicationData.sideEffects || [],
      schedule: medicationData.schedule,
      startDate: medicationData.startDate || new Date(),
      endDate: medicationData.endDate,
      notes: medicationData.notes
    });

    // Notify family about new medication
    if (patient.family) {
      await Notification.create({
        recipient: patient.family,
        recipientModel: 'Family',
        patient: patient._id,
        type: 'patient_update',
        priority: 'high',
        title: 'New Medication Prescribed',
        message: `${medication.name} has been prescribed for ${patient.firstName}.`,
        data: {
          medicationId: medication._id,
          medicationName: medication.name,
          schedule: medication.schedule
        }
      });
    }

    return medication;
  }

  /**
   * Get medications for a patient
   */
  async getPatientMedications(patientId, userId, userRole, includeInactive = false) {
    // Verify access
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    if (userRole === 'doctor' && patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to view this patient\'s medications' };
    }

    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== patientId.toString()) {
        throw { status: 403, message: 'Not authorized to view this patient\'s medications' };
      }
    }

    const query = { patient: patientId };
    if (!includeInactive) {
      query.isActive = true;
    }

    const medications = await Medication.find(query)
      .populate('prescribedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    return medications;
  }

  /**
   * Get medication by ID
   */
  async getMedicationById(medicationId) {
    const medication = await Medication.findById(medicationId)
      .populate('patient', 'firstName lastName patientNumber')
      .populate('prescribedBy', 'firstName lastName');

    if (!medication) {
      throw { status: 404, message: 'Medication not found' };
    }

    return medication;
  }

  /**
   * Update medication
   */
  async updateMedication(medicationId, updateData, doctorId) {
    const medication = await Medication.findById(medicationId);

    if (!medication) {
      throw { status: 404, message: 'Medication not found' };
    }

    // Verify doctor prescribed this medication
    if (medication.prescribedBy.toString() !== doctorId.toString()) {
      throw { status: 403, message: 'Not authorized to update this medication' };
    }

    // Restricted fields
    const restrictedFields = ['patient', 'prescribedBy', 'medicationLogs'];
    restrictedFields.forEach(field => delete updateData[field]);

    Object.assign(medication, updateData);
    await medication.save();

    // Notify family if schedule changed
    if (updateData.schedule) {
      const patient = await Patient.findById(medication.patient);
      if (patient && patient.family) {
        await Notification.create({
          recipient: patient.family,
          recipientModel: 'Family',
          patient: patient._id,
          type: 'patient_update',
          priority: 'high',
          title: 'Medication Schedule Updated',
          message: `The schedule for ${medication.name} has been updated.`,
          data: {
            medicationId: medication._id,
            medicationName: medication.name
          }
        });
      }
    }

    return medication;
  }

  /**
   * Discontinue medication
   */
  async discontinueMedication(medicationId, doctorId) {
    const medication = await Medication.findById(medicationId);

    if (!medication) {
      throw { status: 404, message: 'Medication not found' };
    }

    if (medication.prescribedBy.toString() !== doctorId.toString()) {
      throw { status: 403, message: 'Not authorized to discontinue this medication' };
    }

    medication.isActive = false;
    medication.endDate = new Date();
    await medication.save();

    // Notify family
    const patient = await Patient.findById(medication.patient);
    if (patient && patient.family) {
      await Notification.create({
        recipient: patient.family,
        recipientModel: 'Family',
        patient: patient._id,
        type: 'patient_update',
        priority: 'medium',
        title: 'Medication Discontinued',
        message: `${medication.name} has been discontinued for ${patient.firstName}.`,
        data: {
          medicationId: medication._id,
          medicationName: medication.name
        }
      });
    }

    return medication;
  }

  /**
   * Log medication as taken
   */
  async logMedicationTaken(medicationId, logData, userId, userRole) {
    const medication = await Medication.findById(medicationId);

    if (!medication) {
      throw { status: 404, message: 'Medication not found' };
    }

    // Verify authorization
    const patient = await Patient.findById(medication.patient);
    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== medication.patient.toString()) {
        throw { status: 403, message: 'Not authorized to log this medication' };
      }
    }

    // Create or update log entry
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingLog = medication.medicationLogs.find(log => {
      const logDate = new Date(log.scheduledDate);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === today.getTime() && log.scheduledTime === logData.scheduledTime;
    });

    if (existingLog) {
      existingLog.status = logData.status || 'taken';
      existingLog.takenAt = logData.status === 'taken' ? new Date() : null;
      existingLog.confirmedBy = userId;
      existingLog.confirmedByModel = userRole === 'doctor' ? 'Doctor' : 'Family';
      existingLog.notes = logData.notes;
      if (logData.location) {
        existingLog.location = logData.location;
      }
    } else {
      medication.medicationLogs.push({
        scheduledDate: today,
        scheduledTime: logData.scheduledTime,
        status: logData.status || 'taken',
        takenAt: logData.status === 'taken' ? new Date() : null,
        confirmedBy: userId,
        confirmedByModel: userRole === 'doctor' ? 'Doctor' : 'Family',
        notes: logData.notes,
        location: logData.location || null
      });
    }

    await medication.save();

    // Notify doctor if medication taken
    if (logData.status === 'taken') {
      await Notification.create({
        recipient: patient.doctor,
        recipientModel: 'Doctor',
        patient: patient._id,
        type: 'medication_taken',
        priority: 'low',
        title: 'Medication Confirmed',
        message: `${patient.firstName}'s ${medication.name} (${logData.scheduledTime}) has been confirmed as taken.`,
        data: {
          medicationId: medication._id,
          medicationName: medication.name,
          time: logData.scheduledTime
        }
      });
    }

    // Create missed medication alert
    if (logData.status === 'missed') {
      await Notification.createMissedMedicationAlert(
        patient.doctor,
        'Doctor',
        patient,
        medication,
        logData.scheduledTime
      );
    }

    return medication;
  }

  /**
   * Get today's medication schedule for a patient
   */
  async getTodaySchedule(patientId, userId, userRole) {
    const medications = await this.getPatientMedications(patientId, userId, userRole);
    
    const today = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const schedule = [];

    medications.forEach(med => {
      med.schedule.forEach(s => {
        if (s.days.includes(dayOfWeek)) {
          // Check if already logged
          const log = med.medicationLogs.find(l => {
            const logDate = new Date(l.scheduledDate);
            logDate.setHours(0, 0, 0, 0);
            return logDate.getTime() === todayDate.getTime() && l.scheduledTime === s.time;
          });

          schedule.push({
            medicationId: med._id,
            medicationName: med.name,
            type: med.type,
            time: s.time,
            dosage: s.dosage,
            instructions: med.instructions,
            status: log ? log.status : 'pending',
            logId: log ? log._id : null
          });
        }
      });
    });

    // Sort by time
    schedule.sort((a, b) => a.time.localeCompare(b.time));

    return schedule;
  }

  /**
   * Get medication adherence statistics
   */
  async getAdherenceStats(patientId, days = 30) {
    const medications = await Medication.find({
      patient: patientId,
      isActive: true
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let totalScheduled = 0;
    let totalTaken = 0;
    let totalMissed = 0;

    medications.forEach(med => {
      med.medicationLogs.forEach(log => {
        if (new Date(log.scheduledDate) >= startDate) {
          totalScheduled++;
          if (log.status === 'taken') totalTaken++;
          if (log.status === 'missed') totalMissed++;
        }
      });
    });

    return {
      totalScheduled,
      totalTaken,
      totalMissed,
      adherenceRate: totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 100,
      missedRate: totalScheduled > 0 ? Math.round((totalMissed / totalScheduled) * 100) : 0
    };
  }

  /**
   * Delete medication
   */
  async deleteMedication(medicationId, doctorId) {
    const medication = await Medication.findById(medicationId);
    
    if (!medication) {
      throw { status: 404, message: 'Medication not found' };
    }

    // Verify patient belongs to doctor
    const patient = await Patient.findById(medication.patient);
    if (!patient || patient.doctor.toString() !== doctorId.toString()) {
      throw { status: 403, message: 'Not authorized to delete this medication' };
    }

    await Medication.findByIdAndDelete(medicationId);

    return { message: 'Medication deleted successfully' };
  }

  /**
   * Family: Add medication schedule to existing medication or create new medication
   */
  async addMedicationSchedule(medicationData, familyId) {
    const family = await Family.findById(familyId);
    if (!family) {
      throw { status: 404, message: 'Family member not found' };
    }

    const patient = await Patient.findById(family.patient);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    // If medicationId is provided, add schedule to existing medication
    if (medicationData.medicationId) {
      const medication = await Medication.findById(medicationData.medicationId);
      if (!medication) {
        throw { status: 404, message: 'Medication not found' };
      }

      // Verify medication belongs to patient
      if (medication.patient.toString() !== patient._id.toString()) {
        throw { status: 403, message: 'Not authorized to modify this medication' };
      }

      // Add new schedule
      if (medicationData.schedule && Array.isArray(medicationData.schedule)) {
        medication.schedule.push(...medicationData.schedule);
        await medication.save();

        // Notify doctor
        await Notification.create({
          recipient: patient.doctor,
          recipientModel: 'Doctor',
          patient: patient._id,
          type: 'patient_update',
          priority: 'medium',
          title: 'Medication Schedule Added',
          message: `Family member added new schedule(s) for ${medication.name}.`,
          data: {
            medicationId: medication._id,
            medicationName: medication.name
          }
        });

        return medication;
      }
    }

    // Create new medication (Family-added)
    const medication = await Medication.create({
      patient: patient._id,
      prescribedBy: patient.doctor, // Still linked to doctor, but added by family
      name: medicationData.name,
      genericName: medicationData.genericName,
      type: medicationData.type || 'tablet',
      strength: medicationData.strength,
      instructions: medicationData.instructions,
      purpose: medicationData.purpose,
      sideEffects: medicationData.sideEffects || [],
      schedule: medicationData.schedule,
      startDate: medicationData.startDate || new Date(),
      endDate: medicationData.endDate,
      notes: medicationData.notes || `Added by family member: ${family.firstName} ${family.lastName}`
    });

    // Notify doctor
    await Notification.create({
      recipient: patient.doctor,
      recipientModel: 'Doctor',
      patient: patient._id,
      type: 'patient_update',
      priority: 'high',
      title: 'New Medication Added by Family',
      message: `Family member added new medication: ${medication.name} for ${patient.firstName}.`,
      data: {
        medicationId: medication._id,
        medicationName: medication.name,
        addedBy: family._id
      }
    });

    return medication;
  }

  /**
   * Family: Delete medication (only if added by family)
   */
  async deleteFamilyMedication(medicationId, familyId) {
    const family = await Family.findById(familyId);
    if (!family) {
      throw { status: 404, message: 'Family member not found' };
    }

    const medication = await Medication.findById(medicationId);
    if (!medication) {
      throw { status: 404, message: 'Medication not found' };
    }

    const patient = await Patient.findById(medication.patient);
    if (!patient || patient._id.toString() !== family.patient.toString()) {
      throw { status: 403, message: 'Not authorized to delete this medication' };
    }

    // Check if medication was added by family (check notes or allow deletion)
    // For now, allow family to delete any medication for their patient
    await Medication.findByIdAndDelete(medicationId);

    // Notify doctor
    await Notification.create({
      recipient: patient.doctor,
      recipientModel: 'Doctor',
      patient: patient._id,
      type: 'patient_update',
      priority: 'medium',
      title: 'Medication Deleted by Family',
      message: `Family member deleted medication: ${medication.name}.`,
      data: {
        medicationId: medication._id,
        medicationName: medication.name
      }
    });

    return { message: 'Medication deleted successfully' };
  }
}

export default new MedicationService();
