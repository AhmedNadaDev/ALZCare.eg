import { getDistance } from 'geolib';
import PatientLocation from './location.model.js';
import Notification from '../../models/Notification.model.js';
import Patient from '../../models/Patient.model.js';

// Lazy-imported to avoid circular dependency at startup
const getSafetyZone = async (patientId) => {
  const { default: SafetyZone } = await import('../safetyZone/safetyZone.model.js');
  return SafetyZone.findOne({ patientId }).lean();
};

const MAX_HISTORY = 50;
const THROTTLE_MS = 10_000; // minimum ms between location writes per patient

// In-memory throttle map: patientId → last write timestamp
const _lastWrite = new Map();

class LocationService {
  /**
   * Persist the patient's latest coordinates.
   * Throttled to one write per THROTTLE_MS to avoid DB flooding from
   * fast-firing watchPosition callbacks.
   */
  async updateLocation(patientId, { lat, lng, accuracy }) {
    const now = Date.now();
    const lastTs = _lastWrite.get(String(patientId)) ?? 0;
    if (now - lastTs < THROTTLE_MS) {
      // Still within throttle window — return silently without a DB write
      return { throttled: true };
    }
    _lastWrite.set(String(patientId), now);

    // Read current status before overwriting so we can detect transitions
    const existing = await PatientLocation.findOne(
      { patientId },
      { lastKnownStatus: 1 }
    ).lean();
    const prevStatus = existing?.lastKnownStatus ?? 'unknown';

    // Upsert: keep one document per patient, append to rolling history
    await PatientLocation.findOneAndUpdate(
      { patientId },
      {
        $set: { lat, lng, accuracy: accuracy ?? null },
        $push: {
          history: {
            $each: [{ lat, lng, recordedAt: new Date() }],
            $slice: -MAX_HISTORY,
          },
        },
      },
      { upsert: true }
    );

    // Run geofence check asynchronously (fire-and-forget with error capture)
    this._runGeofenceCheck(patientId, lat, lng, prevStatus).catch((err) =>
      console.error('[Location] Geofence check error:', err)
    );

    return { lat, lng, throttled: false };
  }

  /**
   * Check if the patient is inside or outside their safety zone and
   * create a notification on INSIDE → OUTSIDE transitions.
   */
  async _runGeofenceCheck(patientId, lat, lng, prevStatus) {
    const zone = await getSafetyZone(patientId);
    if (!zone) return; // no zone defined yet

    const distanceM = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: zone.center.lat, longitude: zone.center.lng }
    );

    const currentStatus = distanceM <= zone.radius ? 'inside' : 'outside';

    // Persist the new status
    await PatientLocation.updateOne({ patientId }, { $set: { lastKnownStatus: currentStatus } });

    // Only fire an alert when transitioning from non-outside → outside
    if (prevStatus !== 'outside' && currentStatus === 'outside') {
      await this._createZoneExitAlert(patientId);
    }
  }

  /** Create an urgent zone-exit notification for the patient's family member. */
  async _createZoneExitAlert(patientId) {
    const patient = await Patient.findById(patientId)
      .select('firstName lastName family')
      .lean();
    if (!patient) return;

    if (patient.family) {
      await Notification.create({
        recipient: patient.family,
        recipientModel: 'Family',
        patient: patientId,
        type: 'zone_alert',
        priority: 'urgent',
        title: 'Safety Zone Alert',
        message: `${patient.firstName} ${patient.lastName} has left the safe zone.`,
        data: { alertType: 'zone_exit', patientId: String(patientId) },
      });
    }
  }

  /**
   * Return the patient's latest location together with their safety zone
   * (if one exists). Used by the family dashboard.
   */
  async getPatientLocationWithZone(patientId) {
    const [location, zone] = await Promise.all([
      PatientLocation.findOne({ patientId }).lean(),
      getSafetyZone(patientId),
    ]);
    return { location, zone };
  }
}

export default new LocationService();
