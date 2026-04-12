import doctorAuthService from '../services/doctorAuth.service.js';

class DoctorAuthController {
  /**
   * @route   POST /api/doctor/auth/signup
   * @desc    Register new doctor
   * @access  Public
   */
  async signup(req, res, next) {
    try {
      const result = await doctorAuthService.signup(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Doctor account created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/doctor/auth/login
   * @desc    Login doctor
   * @access  Public
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await doctorAuthService.login(email, password);
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/doctor/auth/profile
   * @desc    Get doctor profile
   * @access  Private (Doctor)
   */
  async getProfile(req, res, next) {
    try {
      const doctor = await doctorAuthService.getProfile(req.doctor._id);
      
      res.status(200).json({
        success: true,
        data: doctor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/doctor/auth/profile
   * @desc    Update doctor profile
   * @access  Private (Doctor)
   */
  async updateProfile(req, res, next) {
    try {
      const doctor = await doctorAuthService.updateProfile(req.doctor._id, req.body);
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: doctor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/doctor/auth/change-password
   * @desc    Change doctor password
   * @access  Private (Doctor)
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await doctorAuthService.changePassword(
        req.doctor._id,
        currentPassword,
        newPassword
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
   * @route   GET /api/doctor/auth/stats
   * @desc    Get doctor statistics
   * @access  Private (Doctor)
   */
  async getStats(req, res, next) {
    try {
      const stats = await doctorAuthService.getStats(req.doctor._id);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/doctor/auth/verify
   * @desc    Verify doctor token
   * @access  Private (Doctor)
   */
  async verifyToken(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          doctor: req.doctor
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DoctorAuthController();
