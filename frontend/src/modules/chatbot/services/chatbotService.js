const API_BASE_URL = 'http://localhost:5001/api';

const DOCTOR_TOKEN_KEY = 'alzcare_doctor_token';
const FAMILY_TOKEN_KEY = 'alzcare_family_token';
const PATIENT_TOKEN_KEY = 'alzcare_patient_token';

const getToken = () =>
  localStorage.getItem(DOCTOR_TOKEN_KEY) ||
  localStorage.getItem(FAMILY_TOKEN_KEY) ||
  localStorage.getItem(PATIENT_TOKEN_KEY);

/**
 * Ask the ALZCare AI assistant.
 *
 * @param {string}      question
 * @param {string|null} patientId  null → GENERAL MODE (no patient selected)
 * @returns {{ answer: string, mode: string, sources: any, metadata: any }}
 */
export const askChatbot = async (question, patientId = null) => {
  const token = getToken();

  const body = { question };
  if (patientId) body.patient_id = patientId;

  const response = await fetch(`${API_BASE_URL}/chatbot/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to get a response from the AI assistant.');
  }

  return data;
};
