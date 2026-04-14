/**
 * Backend HTTP surface for face ML flows (Node API → Python embed service).
 * UI must not call fetch here directly — use inference/* orchestrators from components/hooks.
 */
import { faceRecognitionAPI } from '../../../../../modules/shared/api/api.js';

export const faceRecognitionClient = {
  registerPerson: (formData) => faceRecognitionAPI.register(formData),

  recognizeForFamily: (image) => faceRecognitionAPI.recognize(image),

  /**
   * Public recognition (patient kiosk). Optional patientId for future scoping.
   */
  recognizePublic: (image, patientId) => faceRecognitionAPI.recognizePublic(image, patientId),

  listRegisteredPersons: () => faceRecognitionAPI.getPersons(),
};
