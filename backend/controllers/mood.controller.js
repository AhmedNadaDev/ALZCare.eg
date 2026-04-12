import moodService from '../services/mood.service.js';

class MoodController {
  /**
   * @route   POST /api/moods
   * @desc    Create mood entry
   * @access  Private (Doctor/Family)
   */
  async createMoodEntry(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const moodEntry = await moodService.createMoodEntry(
        req.body,
        userId,
        userRole
      );
      
      res.status(201).json({
        success: true,
        message: 'Mood entry created successfully',
        data: moodEntry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/moods/patient/:patientId
   * @desc    Get mood history for a patient
   * @access  Private (Doctor/Family)
   */
  async getMoodHistory(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const options = {
        days: parseInt(req.query.days) || 30,
        limit: parseInt(req.query.limit) || 50,
        page: parseInt(req.query.page) || 1
      };
      
      const result = await moodService.getMoodHistory(
        req.params.patientId,
        userId,
        userRole,
        options
      );
      
      res.status(200).json({
        success: true,
        data: result.moods,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/moods/:id
   * @desc    Get mood entry by ID
   * @access  Private (Doctor/Family)
   */
  async getMoodEntry(req, res, next) {
    try {
      const mood = await moodService.getMoodById(req.params.id);
      
      res.status(200).json({
        success: true,
        data: mood
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/moods/:id
   * @desc    Update mood entry
   * @access  Private (Doctor/Family - only recorder)
   */
  async updateMoodEntry(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const mood = await moodService.updateMoodEntry(
        req.params.id,
        req.body,
        userId,
        userRole
      );
      
      res.status(200).json({
        success: true,
        message: 'Mood entry updated successfully',
        data: mood
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/moods/:id
   * @desc    Delete mood entry
   * @access  Private (Doctor only)
   */
  async deleteMoodEntry(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const result = await moodService.deleteMoodEntry(
        req.params.id,
        userId,
        userRole
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
   * @route   GET /api/moods/patient/:patientId/stats
   * @desc    Get mood statistics
   * @access  Private (Doctor/Family)
   */
  async getMoodStats(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      const days = parseInt(req.query.days) || 30;
      
      const stats = await moodService.getMoodStats(
        req.params.patientId,
        userId,
        userRole,
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
   * @route   GET /api/moods/patient/:patientId/abnormal
   * @desc    Get abnormal moods
   * @access  Private (Doctor/Family)
   */
  async getAbnormalMoods(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      const days = parseInt(req.query.days) || 30;
      
      const moods = await moodService.getAbnormalMoods(
        req.params.patientId,
        userId,
        userRole,
        days
      );
      
      res.status(200).json({
        success: true,
        count: moods.length,
        data: moods
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MoodController();
