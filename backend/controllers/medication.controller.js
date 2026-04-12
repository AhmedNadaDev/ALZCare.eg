import medicationService from '../services/medication.service.js';

class MedicationController {
  /**
   * @route   POST /api/medications
   * @desc    Create medication
   * @access  Private (Doctor)
   */
  async createMedication(req, res, next) {
    try {
      const medication = await medicationService.createMedication(
        req.body,
        req.doctor._id
      );
      
      res.status(201).json({
        success: true,
        message: 'Medication created successfully',
        data: medication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/medications/patient/:patientId
   * @desc    Get medications for a patient
   * @access  Private (Doctor/Family)
   */
  async getPatientMedications(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      const includeInactive = req.query.includeInactive === 'true';
      
      const medications = await medicationService.getPatientMedications(
        req.params.patientId,
        userId,
        userRole,
        includeInactive
      );
      
      res.status(200).json({
        success: true,
        count: medications.length,
        data: medications
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/medications/:id
   * @desc    Get medication by ID
   * @access  Private (Doctor/Family)
   */
  async getMedication(req, res, next) {
    try {
      const medication = await medicationService.getMedicationById(req.params.id);
      
      res.status(200).json({
        success: true,
        data: medication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/medications/:id
   * @desc    Update medication
   * @access  Private (Doctor)
   */
  async updateMedication(req, res, next) {
    try {
      const medication = await medicationService.updateMedication(
        req.params.id,
        req.body,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Medication updated successfully',
        data: medication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/medications/:id/discontinue
   * @desc    Discontinue medication
   * @access  Private (Doctor)
   */
  async discontinueMedication(req, res, next) {
    try {
      const medication = await medicationService.discontinueMedication(
        req.params.id,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Medication discontinued successfully',
        data: medication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/medications/:id/log
   * @desc    Log medication as taken/missed
   * @access  Private (Doctor/Family)
   */
  async logMedication(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const medication = await medicationService.logMedicationTaken(
        req.params.id,
        req.body,
        userId,
        userRole
      );
      
      res.status(200).json({
        success: true,
        message: 'Medication logged successfully',
        data: medication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/medications/patient/:patientId/today
   * @desc    Get today's medication schedule
   * @access  Private (Doctor/Family)
   */
  async getTodaySchedule(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const schedule = await medicationService.getTodaySchedule(
        req.params.patientId,
        userId,
        userRole
      );
      
      res.status(200).json({
        success: true,
        count: schedule.length,
        data: schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/medications/patient/:patientId/adherence
   * @desc    Get medication adherence statistics
   * @access  Private (Doctor/Family)
   */
  async getAdherenceStats(req, res, next) {
    try {
      const days = parseInt(req.query.days) || 30;
      
      const stats = await medicationService.getAdherenceStats(
        req.params.patientId,
        days
      );
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/medications/:id
   * @desc    Delete medication
   * @access  Private (Doctor)
   */
  async deleteMedication(req, res, next) {
    try {
      const result = await medicationService.deleteMedication(
        req.params.id,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/family/medications
   * @desc    Family: Add medication schedule or create new medication
   * @access  Private (Family)
   */
  async addFamilyMedication(req, res, next) {
    try {
      const medication = await medicationService.addMedicationSchedule(
        req.body,
        req.family._id
      );
      
      res.status(201).json({
        success: true,
        message: 'Medication schedule added successfully',
        data: medication
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/family/medications/:id
   * @desc    Family: Delete medication
   * @access  Private (Family)
   */
  async deleteFamilyMedication(req, res, next) {
    try {
      const result = await medicationService.deleteFamilyMedication(
        req.params.id,
        req.family._id
      );
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MedicationController();
