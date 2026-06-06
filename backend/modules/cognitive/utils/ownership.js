import Patient from '../../../models/Patient.model.js';

/**
 * Centralised patient-access guard for the cognitive module.
 *
 * Mirrors the per-role authorization used across the platform (see
 * medication.service.js) so every cognitive service enforces the same rules:
 *   doctor  → must be the patient's assigned doctor
 *   family  → must be linked to the patient (req.patientId === patientId)
 *   patient → can only act on their own record
 *
 * Returns the loaded Patient document so callers can reuse it.
 *
 * @param {string} patientId
 * @param {{ userId: any, userRole: string, reqPatientId?: any }} ctx
 */
export const assertPatientAccess = async (patientId, { userId, userRole, reqPatientId }) => {
  if (!patientId) throw { status: 400, message: 'patientId is required' };

  const patient = await Patient.findById(patientId);
  if (!patient) throw { status: 404, message: 'Patient not found' };

  if (userRole === 'doctor') {
    if (!patient.doctor || patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to access this patient' };
    }
  } else if (userRole === 'family') {
    if (!reqPatientId || reqPatientId.toString() !== patientId.toString()) {
      throw { status: 403, message: 'Not authorized to access this patient' };
    }
  } else if (userRole === 'patient') {
    if (userId.toString() !== patientId.toString()) {
      throw { status: 403, message: 'Not authorized to access this patient' };
    }
  } else {
    throw { status: 403, message: 'Not authorized' };
  }

  return patient;
};

/** Resolve the createdByModel label from the request role. */
export const modelFromRole = (userRole) => {
  if (userRole === 'doctor') return 'Doctor';
  if (userRole === 'family') return 'Family';
  if (userRole === 'patient') return 'Patient';
  return 'System';
};
