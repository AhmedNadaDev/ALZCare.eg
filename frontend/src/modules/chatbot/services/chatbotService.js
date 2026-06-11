import { tokenManager } from '../../shared/api/api';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001') + '/api';

/**
 * Returns the JWT for the currently active role.
 * Reads the USER_ROLE_KEY written by tokenManager on every login so the
 * correct token is sent even when multiple role-tokens coexist in localStorage
 * (e.g. a stale doctor session while a family member is logged in).
 */
const getToken = () => {
  const role = tokenManager.getUserType();
  if (role === 'doctor')  return tokenManager.getDoctorToken();
  if (role === 'family')  return tokenManager.getFamilyToken();
  if (role === 'patient') return tokenManager.getPatientToken();

  // Fallback: return whatever is available (handles legacy sessions)
  return (
    tokenManager.getDoctorToken() ||
    tokenManager.getFamilyToken() ||
    tokenManager.getPatientToken() ||
    null
  );
};

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
      'ngrok-skip-browser-warning': 'true',
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
