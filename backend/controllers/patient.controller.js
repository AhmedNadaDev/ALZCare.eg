import patientService from '../services/patient.service.js';

class PatientController {
  /**
   * @route   POST /api/doctor/patients
   * @desc    Create new patient with family account
   * @access  Private (Doctor)
   */
  async createPatient(req, res, next) {
    try {
      const { family, ...patientData } = req.body;
      
      // Handle profile image if uploaded
      if (req.file) {
        patientData.profileImage = `/uploads/patients/${req.file.filename}`;
      }
      
      // Convert age to number if it's a string
      if (patientData.age) {
        patientData.age = parseInt(patientData.age);
      }
      
      const result = await patientService.createPatient(
        patientData,
        family,
        req.doctor._id
      );
      
      res.status(201).json({
        success: true,
        message: 'Patient created successfully with family account',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/doctor/patients
   * @desc    Get all patients for doctor
   * @access  Private (Doctor)
   */
  async getPatients(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        alzheimerLevel: req.query.level,
        search: req.query.search
      };
      
      const patients = await patientService.getDoctorPatients(req.doctor._id, filters);
      
      res.status(200).json({
        success: true,
        count: patients.length,
        data: patients
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/doctor/patients/:id
   * @desc    Get patient by ID
   * @access  Private (Doctor/Family)
   */
  async getPatient(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id || req.patient?._id;
      const userRole = req.userRole;
      
      const patient = await patientService.getPatientById(
        req.params.id,
        userId,
        userRole
      );
      
      res.status(200).json({
        success: true,
        data: patient
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/doctor/patients/:id
   * @desc    Update patient
   * @access  Private (Doctor)
   */
  async updatePatient(req, res, next) {
    try {
      const updateData = { ...req.body };
      
      // Handle profile image if uploaded
      if (req.file) {
        updateData.profileImage = `/uploads/patients/${req.file.filename}`;
      }
      
      const patient = await patientService.updatePatient(
        req.params.id,
        updateData,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Patient updated successfully',
        data: patient
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/doctor/patients/:id/notes
   * @desc    Add note to patient
   * @access  Private (Doctor)
   */
  async addNote(req, res, next) {
    try {
      const patient = await patientService.addPatientNote(
        req.params.id,
        req.body.content,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Note added successfully',
        data: patient.notes
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/doctor/patients/:id/notes
   * @desc    Get patient notes
   * @access  Private (Doctor/Family)
   */
  async getNotes(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id || req.patient?._id;
      const userRole = req.userRole;
      
      const notes = await patientService.getPatientNotes(
        req.params.id,
        userId,
        userRole
      );
      
      res.status(200).json({
        success: true,
        data: notes
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/doctor/patients/:id/status
   * @desc    Update patient status
   * @access  Private (Doctor)
   */
  async updateStatus(req, res, next) {
    try {
      const patient = await patientService.updatePatientStatus(
        req.params.id,
        req.body.status,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Status updated successfully',
        data: patient
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/doctor/patients/:id/appointment
   * @desc    Schedule appointment
   * @access  Private (Doctor)
   */
  async scheduleAppointment(req, res, next) {
    try {
      const patient = await patientService.scheduleAppointment(
        req.params.id,
        req.body.appointmentDate,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Appointment scheduled successfully',
        data: patient
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/doctor/patients/:id/stats
   * @desc    Get patient statistics
   * @access  Private (Doctor/Family)
   */
  async getPatientStats(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id || req.patient?._id;
      const userRole = req.userRole;
      
      const stats = await patientService.getPatientStats(
        req.params.id,
        userId,
        userRole
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
   * @route   DELETE /api/doctor/patients/:id
   * @desc    Delete patient
   * @access  Private (Doctor)
   */
  async deletePatient(req, res, next) {
    try {
      const result = await patientService.deletePatient(
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
}

export default new PatientController();
