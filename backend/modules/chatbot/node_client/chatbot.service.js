import axios from 'axios';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

const pythonClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  timeout: 60000,
});

/**
 * Send a question to the Python AI service.
 *
 * @param {string}      question
 * @param {string|null} patientId   null → GENERAL MODE
 * @param {string}      sessionId   per-user key for general conversations
 * @param {string}      userRole    'doctor' | 'family'  (controls output style)
 */
export const askChatbot = async (question, patientId, sessionId = 'general', userRole = 'doctor') => {
  const response = await pythonClient.post('/chat/ask', {
    question,
    patient_id: patientId || null,
    session_id: sessionId,
    user_role:  userRole,
  });
  return response.data;
};

export const checkPythonHealth = async () => {
  const response = await pythonClient.get('/health');
  return response.data;
};
