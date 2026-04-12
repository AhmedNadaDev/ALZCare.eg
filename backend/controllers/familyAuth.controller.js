import familyAuthService from '../services/familyAuth.service.js';

class FamilyAuthController {
  /**
   * @route   POST /api/family/auth/login
   * @desc    Login family member
   * @access  Public
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await familyAuthService.login(email, password);
      
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
   * @route   GET /api/family/auth/profile
   * @desc    Get family profile
   * @access  Private (Family)
   */
  async getProfile(req, res, next) {
    try {
      const family = await familyAuthService.getProfile(req.family._id);
      
      res.status(200).json({
        success: true,
        data: family
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/family/auth/profile
   * @desc    Update family profile
   * @access  Private (Family)
   */
  async updateProfile(req, res, next) {
    try {
      const family = await familyAuthService.updateProfile(req.family._id, req.body);
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: family
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/family/auth/change-password
   * @desc    Change family password
   * @access  Private (Family)
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await familyAuthService.changePassword(
        req.family._id,
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
   * @route   GET /api/family/auth/verify
   * @desc    Verify family token
   * @access  Private (Family)
   */
  async verifyToken(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          family: req.family
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== DOCTOR-ONLY ENDPOINTS =====

  /**
   * @route   GET /api/doctor/patients/:patientId/family
   * @desc    Get family account for a patient (Doctor use)
   * @access  Private (Doctor)
   */
  async getFamilyByPatient(req, res, next) {
    try {
      const family = await familyAuthService.getFamilyByPatient(
        req.params.patientId,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        data: family
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/doctor/family/:id/deactivate
   * @desc    Deactivate family account (Doctor use)
   * @access  Private (Doctor)
   */
  async deactivateAccount(req, res, next) {
    try {
      const result = await familyAuthService.deactivateAccount(
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
   * @route   PUT /api/doctor/family/:id/permissions
   * @desc    Update family permissions (Doctor use)
   * @access  Private (Doctor)
   */
  async updatePermissions(req, res, next) {
    try {
      const family = await familyAuthService.updatePermissions(
        req.params.id,
        req.body.permissions,
        req.doctor._id
      );
      
      res.status(200).json({
        success: true,
        message: 'Permissions updated successfully',
        data: family
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FamilyAuthController();
