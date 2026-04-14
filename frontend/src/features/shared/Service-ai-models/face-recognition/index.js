export { FACE_MODEL_IDS, DEFAULT_MODEL_NAME } from './models/modelConfig.js';
export { stripDataUrlPrefix } from './utils/imageBase64.js';
export { faceRecognitionClient } from './api/faceRecognitionClient.js';
export {
  submitFamilyPersonRegistration,
  fetchRegisteredPersonsForFamily,
} from './inference/registerPerson.js';
export { recognizeFromPatientPage } from './inference/patientRecognition.js';
