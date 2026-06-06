import SafetyZone from './safetyZone.model.js';

class SafetyZoneService {
  /**
   * Create or replace the safety zone for a patient.
   * Only one zone is allowed per patient (upsert by patientId).
   */
  async upsertZone(familyId, patientId, { centerLat, centerLng, radius }) {
    const zone = await SafetyZone.findOneAndUpdate(
      { patientId },
      {
        $set: {
          center: { lat: centerLat, lng: centerLng },
          radius,
          createdBy: familyId,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return zone;
  }

  /** Retrieve the safety zone for a patient (returns null if none exists). */
  async getZone(patientId) {
    return SafetyZone.findOne({ patientId }).lean();
  }
}

export default new SafetyZoneService();
