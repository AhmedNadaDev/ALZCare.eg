import { faceRecognitionClient } from '../api/faceRecognitionClient.js';

/**
 * Patient page live recognition loop — uses public backend route (no auth).
 */
export async function recognizeFromPatientPage(dataUrl, patientId) {
  return faceRecognitionClient.recognizePublic(dataUrl, patientId);
}
