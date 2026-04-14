import authService from '../services/auth.service.js';

class AuthController {
  /**
   * @route POST /api/auth/login
   * @desc Unified login by role
   * @access Public
   */
  async login(req, res, next) {
    try {
      const { email, password, role } = req.body;
      const result = await authService.login(email, password, role);
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
   * @route GET /api/auth/verify
   * @desc Verify active token
   * @access Private
   */
  async verifyToken(req, res, next) {
    try {
      const data = { role: req.userRole };
      if (req.userRole === 'doctor') data.doctor = req.doctor;
      if (req.userRole === 'family') data.family = req.family;
      if (req.userRole === 'patient') data.patient = req.patient;

      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
