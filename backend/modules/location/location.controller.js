import locationService from './location.service.js';

class LocationController {
  /**
   * POST /api/patient/location
   * Patient device sends its current GPS coordinates.
   * Auth: patient JWT required.
   */
  async updateLocation(req, res, next) {
    try {
      const { lat, lng, accuracy } = req.body;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'lat and lng must be numbers.',
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'lat must be −90 to 90 and lng must be −180 to 180.',
        });
      }

      const result = await locationService.updateLocation(req.patient._id, {
        lat,
        lng,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/family/location/:patientId
   * Family member retrieves the linked patient's latest location + safety zone.
   * Auth: family JWT required. Access is validated against the linked patient.
   */
  async getPatientLocation(req, res, next) {
    try {
      const { patientId } = req.params;

      // Family may only access their own linked patient
      const linkedId = req.family?.patient?._id?.toString();
      if (!linkedId || linkedId !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your linked patient.',
        });
      }

      const data = await locationService.getPatientLocationWithZone(patientId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new LocationController();
