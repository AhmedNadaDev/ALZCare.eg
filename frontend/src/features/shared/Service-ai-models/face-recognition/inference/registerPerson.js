import { faceRecognitionClient } from '../api/faceRecognitionClient.js';

/**
 * Family dashboard: submit registration — backend runs ML embed + DB persist.
 */
export async function submitFamilyPersonRegistration(formData) {
  return faceRecognitionClient.registerPerson(formData);
}

export async function fetchRegisteredPersonsForFamily() {
  return faceRecognitionClient.listRegisteredPersons();
}
