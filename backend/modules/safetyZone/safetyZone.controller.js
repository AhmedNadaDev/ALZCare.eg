import safetyZoneService from './safetyZone.service.js';

class SafetyZoneController {
  /**
   * POST /api/family/safety-zone
   * Create or update the safety zone for the family's linked patient.
   * Auth: family JWT required.
   */
  async upsertZone(req, res, next) {
    try {
      const familyId = req.family._id;
      const patientId = req.family.patient?._id;

      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: 'No patient linked to this family account.',
        });
      }

      const { centerLat, centerLng, radius } = req.body;

      if (
        typeof centerLat !== 'number' ||
        typeof centerLng !== 'number' ||
        typeof radius !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          message: 'centerLat, centerLng, and radius must be numbers.',
        });
      }

      if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates.',
        });
      }

      if (radius < 50 || radius > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Radius must be between 50 and 5000 metres.',
        });
      }

      const zone = await safetyZoneService.upsertZone(familyId, patientId, {
        centerLat,
        centerLng,
        radius,
      });

      return res.status(200).json({ success: true, data: zone });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/family/safety-zone/:patientId
   * Retrieve the safety zone for the linked patient.
   * Auth: family JWT required.
   */
  async getZone(req, res, next) {
    try {
      const { patientId } = req.params;

      const linkedId = req.family?.patient?._id?.toString();
      if (!linkedId || linkedId !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your linked patient\'s zone.',
        });
      }

      const zone = await safetyZoneService.getZone(patientId);
      return res.status(200).json({ success: true, data: zone });
    } catch (error) {
      next(error);
    }
  }
}

export default new SafetyZoneController();
