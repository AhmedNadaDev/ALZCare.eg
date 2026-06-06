/**
 * Build the authorization context consumed by the cognitive services from an
 * authenticated request (populated by protectDoctorOrFamily).
 */
export const ctxFromReq = (req) => ({
  userId: req.user._id,
  userRole: req.userRole,
  reqPatientId: req.patientId,
});

/**
 * Resolve the target patient id for a request:
 *   explicit route param  →  body  →  the family/patient's own linked patient.
 * Ownership is always re-validated in the service via assertPatientAccess.
 */
export const resolvePatientId = (req) =>
  req.params.patientId || req.body?.patientId || req.patientId;
