/**
 * Doctor Dashboard API Service
 * Completely isolated from any existing auth system
 */

const API_BASE_URL = 'http://localhost:5001/api';

// Token storage keys (separate from any existing auth)
const DOCTOR_TOKEN_KEY = 'alzcare_doctor_token';
const FAMILY_TOKEN_KEY = 'alzcare_family_token';
const PATIENT_TOKEN_KEY = 'alzcare_patient_token';

// API Request helper
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization header if token exists
  const token =
    localStorage.getItem(DOCTOR_TOKEN_KEY) ||
    localStorage.getItem(FAMILY_TOKEN_KEY) ||
    localStorage.getItem(PATIENT_TOKEN_KEY);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  // Handle FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    config.body = options.body;
  }

  try {
    const response = await fetch(url, config);

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw {
        status: response.status,
        message: `Server returned non-JSON response: ${text.substring(0, 100)}`
      };
    }

    if (!response.ok) {
      throw {
        status: response.status,
        message: data.message || data.error || 'An error occurred',
        errors: data.errors
      };
    }

    return data;
  } catch (error) {
    if (error.status) {
      throw error;
    }
    throw {
      status: 500,
      message: error.message || 'Network error. Please check your connection.'
    };
  }
};

// ===== DOCTOR AUTH API =====
export const doctorAuthAPI = {
  signup: (data) => apiRequest('/doctor/auth/signup', { method: 'POST', body: data }),
  login: (data) => apiRequest('/doctor/auth/login', { method: 'POST', body: data }),
  getProfile: () => apiRequest('/doctor/auth/profile'),
  updateProfile: (data) => apiRequest('/doctor/auth/profile', { method: 'PUT', body: data }),
  changePassword: (data) => apiRequest('/doctor/auth/change-password', { method: 'PUT', body: data }),
  getStats: () => apiRequest('/doctor/auth/stats'),
  verify: () => apiRequest('/doctor/auth/verify'),
};

// ===== FAMILY AUTH API =====
export const familyAuthAPI = {
  login: (data) => apiRequest('/family/auth/login', { method: 'POST', body: data }),
  getProfile: () => apiRequest('/family/auth/profile'),
  updateProfile: (data) => apiRequest('/family/auth/profile', { method: 'PUT', body: data }),
  changePassword: (data) => apiRequest('/family/auth/change-password', { method: 'PUT', body: data }),
  verify: () => apiRequest('/family/auth/verify'),
};

// ===== PATIENT AUTH API =====
export const patientAuthAPI = {
  login: (data) => apiRequest('/auth/login', { method: 'POST', body: { ...data, role: 'patient' } }),
  getProfile: () => apiRequest('/auth/verify'),
  verify: () => apiRequest('/auth/verify'),
};

// ===== PATIENTS API =====
export const patientsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/doctor/patients${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id) => apiRequest(`/doctor/patients/${id}`),
  create: (data) => {
    if (data instanceof FormData) {
      return apiRequest('/doctor/patients', { method: 'POST', body: data });
    }
    return apiRequest('/doctor/patients', { method: 'POST', body: data });
  },
  update: (id, data) => apiRequest(`/doctor/patients/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiRequest(`/doctor/patients/${id}`, { method: 'DELETE' }),
  updateStatus: (id, status) => apiRequest(`/doctor/patients/${id}/status`, { method: 'PUT', body: { status } }),
  addNote: (id, content) => apiRequest(`/doctor/patients/${id}/notes`, { method: 'POST', body: { content } }),
  getNotes: (id) => apiRequest(`/doctor/patients/${id}/notes`),
  getStats: (id) => apiRequest(`/doctor/patients/${id}/stats`),
  scheduleAppointment: (id, date) => apiRequest(`/doctor/patients/${id}/appointment`, { method: 'POST', body: { appointmentDate: date } }),
  getFamily: (patientId) => apiRequest(`/doctor/patients/${patientId}/family`),
};

// ===== MEDICATIONS API =====
export const medicationsAPI = {
  create: (data) => apiRequest('/medications', { method: 'POST', body: data }),
  getByPatient: (patientId, includeInactive = false) => 
    apiRequest(`/medications/patient/${patientId}?includeInactive=${includeInactive}`),
  getById: (id) => apiRequest(`/medications/${id}`),
  update: (id, data) => apiRequest(`/medications/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiRequest(`/medications/${id}`, { method: 'DELETE' }),
  discontinue: (id) => apiRequest(`/medications/${id}/discontinue`, { method: 'PUT' }),
  log: (id, data) => apiRequest(`/medications/${id}/log`, { method: 'POST', body: data }),
  getTodaySchedule: (patientId) => apiRequest(`/medications/patient/${patientId}/today`),
  getAdherence: (patientId, days = 30) => apiRequest(`/medications/patient/${patientId}/adherence?days=${days}`),
};

// ===== MOODS API =====
export const moodsAPI = {
  create: (data) => apiRequest('/moods', { method: 'POST', body: data }),
  getByPatient: (patientId, options = {}) => {
    const params = new URLSearchParams(options).toString();
    return apiRequest(`/moods/patient/${patientId}${params ? `?${params}` : ''}`);
  },
  getById: (id) => apiRequest(`/moods/${id}`),
  update: (id, data) => apiRequest(`/moods/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiRequest(`/moods/${id}`, { method: 'DELETE' }),
  getStats: (patientId, days = 30) => apiRequest(`/moods/patient/${patientId}/stats?days=${days}`),
  getAbnormal: (patientId, days = 30) => apiRequest(`/moods/patient/${patientId}/abnormal?days=${days}`),
};

// ===== FAMILY MEDICATIONS API =====
export const familyMedicationsAPI = {
  add: (data) => apiRequest('/family/medications', { method: 'POST', body: data }),
  delete: (id) => apiRequest(`/family/medications/${id}`, { method: 'DELETE' }),
};

// ===== NOTIFICATIONS API =====
export const notificationsAPI = {
  getAll: (options = {}) => {
    const params = new URLSearchParams(options).toString();
    return apiRequest(`/notifications${params ? `?${params}` : ''}`);
  },
  getUnreadCount: () => apiRequest('/notifications/unread-count'),
  getRecent: (limit = 5) => apiRequest(`/notifications/recent?limit=${limit}`),
  getStats: () => apiRequest('/notifications/stats'),
  markAsRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),
  archive: (id) => apiRequest(`/notifications/${id}/archive`, { method: 'PUT' }),
  delete: (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' }),
};

// ===== FACE RECOGNITION API =====
export const faceRecognitionAPI = {
  register: (formData) => apiRequest('/family/face-recognition/register', { method: 'POST', body: formData }),
  recognize: (image) => apiRequest('/family/face-recognition/recognize', { method: 'POST', body: { image } }),
  recognizePublic: (image, patientId) => apiRequest('/face-recognition/patient/recognize', { method: 'POST', body: { image, patientId } }),
  getPersons: () => apiRequest('/family/face-recognition/persons'),
};

// ===== TOKEN MANAGEMENT =====
export const tokenManager = {
  setDoctorToken: (token) => localStorage.setItem(DOCTOR_TOKEN_KEY, token),
  setFamilyToken: (token) => localStorage.setItem(FAMILY_TOKEN_KEY, token),
  setPatientToken: (token) => localStorage.setItem(PATIENT_TOKEN_KEY, token),
  getDoctorToken: () => localStorage.getItem(DOCTOR_TOKEN_KEY),
  getFamilyToken: () => localStorage.getItem(FAMILY_TOKEN_KEY),
  getPatientToken: () => localStorage.getItem(PATIENT_TOKEN_KEY),
  clearDoctorToken: () => localStorage.removeItem(DOCTOR_TOKEN_KEY),
  clearFamilyToken: () => localStorage.removeItem(FAMILY_TOKEN_KEY),
  clearPatientToken: () => localStorage.removeItem(PATIENT_TOKEN_KEY),
  clearAllTokens: () => {
    localStorage.removeItem(DOCTOR_TOKEN_KEY);
    localStorage.removeItem(FAMILY_TOKEN_KEY);
    localStorage.removeItem(PATIENT_TOKEN_KEY);
  },
  isAuthenticated: () => !!(
    localStorage.getItem(DOCTOR_TOKEN_KEY) ||
    localStorage.getItem(FAMILY_TOKEN_KEY) ||
    localStorage.getItem(PATIENT_TOKEN_KEY)
  ),
  getUserType: () => {
    if (localStorage.getItem(DOCTOR_TOKEN_KEY)) return 'doctor';
    if (localStorage.getItem(FAMILY_TOKEN_KEY)) return 'family';
    if (localStorage.getItem(PATIENT_TOKEN_KEY)) return 'patient';
    return null;
  }
};

export default {
  doctorAuthAPI,
  familyAuthAPI,
  patientAuthAPI,
  patientsAPI,
  medicationsAPI,
  familyMedicationsAPI,
  moodsAPI,
  notificationsAPI,
  faceRecognitionAPI,
  tokenManager,
};
