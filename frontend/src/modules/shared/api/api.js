/**
 * Doctor Dashboard API Service
 * Completely isolated from any existing auth system
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001') + '/api';

// Token storage keys
const DOCTOR_TOKEN_KEY  = 'alzcare_doctor_token';
const FAMILY_TOKEN_KEY  = 'alzcare_family_token';
const PATIENT_TOKEN_KEY = 'alzcare_patient_token';

/**
 * Explicit role key — written on every login / token set.
 * Used by tokenManager helpers and getActiveToken() for generic auth checks.
 */
const USER_ROLE_KEY = 'alzcare_user_role';

/**
 * Returns the active JWT for the currently logged-in role.
 * Used only for mixed-role API calls (chatbot, etc.).
 * Role-specific API groups use their dedicated token directly — see below.
 */
const getActiveToken = () => {
  const role = localStorage.getItem(USER_ROLE_KEY);
  if (role === 'doctor')  return localStorage.getItem(DOCTOR_TOKEN_KEY);
  if (role === 'family')  return localStorage.getItem(FAMILY_TOKEN_KEY);
  if (role === 'patient') return localStorage.getItem(PATIENT_TOKEN_KEY);

  // Backwards-compat fallback
  return (
    localStorage.getItem(DOCTOR_TOKEN_KEY) ||
    localStorage.getItem(FAMILY_TOKEN_KEY) ||
    localStorage.getItem(PATIENT_TOKEN_KEY) ||
    null
  );
};

/**
 * Core HTTP helper — accepts an explicit token so callers control which
 * credential is sent.  This prevents cross-role token contamination when
 * multiple sessions coexist in the same browser (e.g. family dashboard open
 * alongside patient dashboard in another tab sharing the same localStorage).
 */
const makeRequest = async (endpoint, options = {}, token) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    // Bypass the ngrok browser-warning interstitial page so fetch/XHR calls
    // get the real JSON response instead of an HTML warning page.
    'ngrok-skip-browser-warning': 'true',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { ...options, headers };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    config.body = options.body;
  }

  try {
    const response = await fetch(url, config);

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw {
        status: response.status,
        message: `Server returned non-JSON response: ${text.substring(0, 100)}`,
      };
    }

    if (!response.ok) {
      throw {
        status: response.status,
        message: data.message || data.error || 'An error occurred',
        errors: data.errors,
      };
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    throw {
      status: 500,
      message: error.message || 'Network error. Please check your connection.',
    };
  }
};

/**
 * Role-pinned request helpers.
 * Each always reads its own dedicated token key regardless of which role
 * USER_ROLE_KEY currently points to.  This prevents cross-role token
 * contamination when multiple sessions share the same localStorage.
 */
const doctorRequest  = (endpoint, options = {}) =>
  makeRequest(endpoint, options, localStorage.getItem(DOCTOR_TOKEN_KEY));

const familyRequest  = (endpoint, options = {}) =>
  makeRequest(endpoint, options, localStorage.getItem(FAMILY_TOKEN_KEY));

const patientRequest = (endpoint, options = {}) =>
  makeRequest(endpoint, options, localStorage.getItem(PATIENT_TOKEN_KEY));

/**
 * For endpoints that accept BOTH doctor and family tokens (protectDoctorOrFamily).
 * Picks doctor token when the active role is doctor, otherwise family token.
 * Never sends a patient token to these endpoints regardless of USER_ROLE_KEY.
 */
const doctorOrFamilyRequest = (endpoint, options = {}) => {
  const role  = localStorage.getItem(USER_ROLE_KEY);
  const token = role === 'doctor'
    ? localStorage.getItem(DOCTOR_TOKEN_KEY)
    : localStorage.getItem(FAMILY_TOKEN_KEY);
  return makeRequest(endpoint, options, token);
};

/** Generic request — reads active role; use for truly shared / public endpoints. */
const apiRequest = (endpoint, options = {}) =>
  makeRequest(endpoint, options, getActiveToken());

/**
 * Multipart request for doctor/family management endpoints (memory media).
 * Picks the doctor token when the active role is doctor, otherwise family.
 * Content-Type is dropped by makeRequest when the body is FormData.
 */
const dfFormRequest = (endpoint, formData, method = 'POST') => {
  const role = localStorage.getItem(USER_ROLE_KEY);
  const token =
    role === 'doctor'
      ? localStorage.getItem(DOCTOR_TOKEN_KEY)
      : localStorage.getItem(FAMILY_TOKEN_KEY);
  return makeRequest(endpoint, { method, body: formData }, token);
};

// ===== DOCTOR AUTH API =====
export const doctorAuthAPI = {
  signup: (data) => makeRequest('/doctor/auth/signup', { method: 'POST', body: data }, null), // public
  login:  (data) => makeRequest('/doctor/auth/login',  { method: 'POST', body: data }, null), // public
  getProfile:     () => doctorRequest('/doctor/auth/profile'),
  updateProfile:  (data) => doctorRequest('/doctor/auth/profile', { method: 'PUT', body: data }),
  changePassword: (data) => doctorRequest('/doctor/auth/change-password', { method: 'PUT', body: data }),
  getStats:       () => doctorRequest('/doctor/auth/stats'),
  verify:         () => doctorRequest('/doctor/auth/verify'),
};

// ===== FAMILY AUTH API =====
export const familyAuthAPI = {
  login:          (data) => makeRequest('/family/auth/login', { method: 'POST', body: data }, null), // public
  getProfile:     () => familyRequest('/family/auth/profile'),
  updateProfile:  (data) => familyRequest('/family/auth/profile', { method: 'PUT', body: data }),
  changePassword: (data) => familyRequest('/family/auth/change-password', { method: 'PUT', body: data }),
  verify:         () => familyRequest('/family/auth/verify'),
};

// ===== PATIENT AUTH API =====
export const patientAuthAPI = {
  login:      (data) => makeRequest('/auth/login', { method: 'POST', body: { ...data, role: 'patient' } }, null), // public
  getProfile: () => patientRequest('/auth/verify'),
  verify:     () => patientRequest('/auth/verify'),
};

// ===== PATIENTS API =====
export const patientsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return doctorRequest(`/doctor/patients${queryString ? `?${queryString}` : ''}`);
  },
  getById:     (id) => doctorRequest(`/doctor/patients/${id}`),
  create:      (data) => doctorRequest('/doctor/patients', { method: 'POST', body: data }),
  update:      (id, data) => doctorRequest(`/doctor/patients/${id}`, { method: 'PUT', body: data }),
  delete:      (id) => doctorRequest(`/doctor/patients/${id}`, { method: 'DELETE' }),
  updateStatus: (id, status) => doctorRequest(`/doctor/patients/${id}/status`, { method: 'PUT', body: { status } }),
  addNote:     (id, content) => doctorRequest(`/doctor/patients/${id}/notes`, { method: 'POST', body: { content } }),
  getNotes:    (id) => doctorRequest(`/doctor/patients/${id}/notes`),
  getStats:    (id) => doctorRequest(`/doctor/patients/${id}/stats`),
  scheduleAppointment: (id, date) =>
    doctorRequest(`/doctor/patients/${id}/appointment`, { method: 'POST', body: { appointmentDate: date } }),
  getFamily: (patientId) => doctorRequest(`/doctor/patients/${patientId}/family`),
};

// ===== MEDICATIONS API =====
// Write routes are doctor-only; read routes accept doctor OR family (protectDoctorOrFamily).
export const medicationsAPI = {
  create:      (data) => doctorRequest('/medications', { method: 'POST', body: data }),
  update:      (id, data) => doctorRequest(`/medications/${id}`, { method: 'PUT', body: data }),
  delete:      (id) => doctorRequest(`/medications/${id}`, { method: 'DELETE' }),
  discontinue: (id) => doctorRequest(`/medications/${id}/discontinue`, { method: 'PUT' }),

  // Read + log — accessible by doctor AND family
  getByPatient: (patientId, includeInactive = false) =>
    doctorOrFamilyRequest(`/medications/patient/${patientId}?includeInactive=${includeInactive}`),
  getById:          (id) => doctorOrFamilyRequest(`/medications/${id}`),
  log:              (id, data) => doctorOrFamilyRequest(`/medications/${id}/log`, { method: 'POST', body: data }),
  getTodaySchedule: (patientId) => doctorOrFamilyRequest(`/medications/patient/${patientId}/today`),
  getAdherence:     (patientId, days = 30) =>
    doctorOrFamilyRequest(`/medications/patient/${patientId}/adherence?days=${days}`),
};

// ===== FAMILY MEDICATIONS API =====
export const familyMedicationsAPI = {
  add:    (data) => familyRequest('/family/medications', { method: 'POST', body: data }),
  delete: (id)   => familyRequest(`/family/medications/${id}`, { method: 'DELETE' }),
};

// ===== NOTIFICATIONS API =====
// All notification routes use protectDoctorOrFamily on the backend,
// so we must send whichever token the active role has (doctor OR family).
export const notificationsAPI = {
  getAll: (options = {}) => {
    const params = new URLSearchParams(options).toString();
    return doctorOrFamilyRequest(`/notifications${params ? `?${params}` : ''}`);
  },
  getUnreadCount: () => doctorOrFamilyRequest('/notifications/unread-count'),
  getRecent:      (limit = 5) => doctorOrFamilyRequest(`/notifications/recent?limit=${limit}`),
  getStats:       () => doctorOrFamilyRequest('/notifications/stats'),
  markAsRead:     (id) => doctorOrFamilyRequest(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead:  () => doctorOrFamilyRequest('/notifications/read-all', { method: 'PUT' }),
  archive:        (id) => doctorOrFamilyRequest(`/notifications/${id}/archive`, { method: 'PUT' }),
  delete:         (id) => doctorOrFamilyRequest(`/notifications/${id}`, { method: 'DELETE' }),
};

// ===== FACE RECOGNITION API =====
export const faceRecognitionAPI = {
  register:  (formData) =>
    familyRequest('/family/face-recognition/register', { method: 'POST', body: formData }),
  recognize: (image) =>
    familyRequest('/family/face-recognition/recognize', { method: 'POST', body: { image } }),
  recognizePublic: (image, patientId) =>
    makeRequest('/face-recognition/patient/recognize', { method: 'POST', body: { image, patientId } }, null), // public
  getPersons: () => familyRequest('/family/face-recognition/persons'),
};

// ===== DAILY PLAN API =====
export const dailyPlanAPI = {
  /** Family: create or replace a full day plan */
  upsert: (data) => familyRequest('/family/daily-plan', { method: 'POST', body: data }),

  /** Family: append events to a day plan */
  addEvents: (data) => familyRequest('/family/daily-plan/events', { method: 'POST', body: data }),

  /** Get today's plan for a patient (called by both patient & family dashboards) */
  getToday:  (patientId) => apiRequest(`/patient/${patientId}/daily-plan/today`),

  /** Get plan for specific date */
  getByDate: (patientId, date) => apiRequest(`/patient/${patientId}/daily-plan?date=${date}`),

  /** Patient voice response — sent with patient token */
  respondToEvent: (planId, eventId, responseText, patientId) =>
    patientRequest(`/daily-plan/${planId}/event/${eventId}/respond`, {
      method: 'POST',
      body: { responseText, patientId }
    }),

  /** Manual confirm — family action */
  manualConfirm: (planId, eventId, status) =>
    familyRequest(`/family/daily-plan/${planId}/event/${eventId}/manual`, {
      method: 'PUT',
      body: { status }
    }),

  /** Update event — family action */
  updateEvent: (planId, eventId, data) =>
    familyRequest(`/family/daily-plan/${planId}/event/${eventId}`, { method: 'PUT', body: data }),

  /** Delete event — family action */
  deleteEvent: (planId, eventId) =>
    familyRequest(`/family/daily-plan/${planId}/event/${eventId}`, { method: 'DELETE' }),
};

// ===== AI MOOD CHECK-IN API =====
export const aiMoodAPI = {
  /**
   * Family/Doctor: create or update a daily mood check-in schedule for a patient.
   * Body: { patientId, scheduledTime: "HH:MM", isActive? }
   */
  setSchedule: (data) =>
    doctorOrFamilyRequest('/mood-checkin/schedule', { method: 'POST', body: data }),

  /** Family/Doctor: read the current schedule for a patient */
  getSchedule: (patientId) =>
    doctorOrFamilyRequest(`/mood-checkin/schedule/${patientId}`),

  /** Family/Doctor: paginated AI mood history */
  getHistory: (patientId, { days = 30, limit = 50 } = {}) =>
    doctorOrFamilyRequest(`/mood-checkin/history/${patientId}?days=${days}&limit=${limit}`),

  /**
   * Latest single AI mood result.
   * Uses apiRequest (active-role token) so it works for doctor, family AND patient.
   */
  getLatest: (patientId) =>
    apiRequest(`/mood-checkin/latest/${patientId}`),

  /** Family/Doctor: emotion frequency breakdown */
  getStats: (patientId, days = 30) =>
    doctorOrFamilyRequest(`/mood-checkin/stats/${patientId}?days=${days}`),

  /**
   * Patient: upload recorded audio blob for emotion analysis.
   * Uses patient token + FormData (Content-Type header removed by makeRequest).
   */
  analyzeAudio: (formData) =>
    makeRequest(
      '/mood-checkin/analyze',
      { method: 'POST', body: formData },
      localStorage.getItem(PATIENT_TOKEN_KEY)
    ),
};

// ===== CHATBOT API =====
export const chatbotAPI = {
  // Chatbot is accessible to all roles — use generic token selection
  ask: (question, patientId = null) => {
    const body = { question };
    if (patientId) body.patient_id = patientId;
    return apiRequest('/chatbot/ask', { method: 'POST', body });
  },
};

// ===== LOCATION & SAFETY ZONE API =====
export const locationAPI = {
  sendPatientLocation: (data) =>
    patientRequest('/patient/location', { method: 'POST', body: data }),
  getPatientLocation: (patientId) =>
    familyRequest(`/family/location/${patientId}`),
  saveSafetyZone: (data) =>
    familyRequest('/family/safety-zone', { method: 'POST', body: data }),
  getSafetyZone: (patientId) =>
    familyRequest(`/family/safety-zone/${patientId}`),
};

// ===== COGNITIVE / MEMORY ASSISTANT API =====
// Backend routes use protectDoctorOrFamily (accepts doctor, family AND patient).
// Management calls go through doctor/family tokens; the patient experience
// (session play) uses the active token (patient when on the patient device).
export const cognitiveAPI = {
  // ── Exercise template catalogue ──
  getTemplates: () => apiRequest('/cognitive/exercise-templates'),

  // ── Memory albums & items (family/doctor manage) ──
  listAlbums: (patientId, includeInactive = false) =>
    doctorOrFamilyRequest(`/cognitive/patients/${patientId}/albums?includeInactive=${includeInactive}`),
  getAlbum: (albumId) => apiRequest(`/cognitive/albums/${albumId}`),
  createAlbum: (patientId, formData) =>
    dfFormRequest(`/cognitive/patients/${patientId}/albums`, formData, 'POST'),
  updateAlbum: (albumId, formData) => dfFormRequest(`/cognitive/albums/${albumId}`, formData, 'PUT'),
  deleteAlbum: (albumId) => doctorOrFamilyRequest(`/cognitive/albums/${albumId}`, { method: 'DELETE' }),
  addItem: (albumId, formData) => dfFormRequest(`/cognitive/albums/${albumId}/items`, formData, 'POST'),
  updateItem: (itemId, formData) => dfFormRequest(`/cognitive/items/${itemId}`, formData, 'PUT'),
  deleteItem: (itemId) => doctorOrFamilyRequest(`/cognitive/items/${itemId}`, { method: 'DELETE' }),
  reorderItems: (albumId, order) =>
    doctorOrFamilyRequest(`/cognitive/albums/${albumId}/reorder`, { method: 'PUT', body: { order } }),
  logAlbumView: (albumId) => apiRequest(`/cognitive/albums/${albumId}/view`, { method: 'POST' }),

  // ── Assignments (PatientAssignments) ──
  listAssignments: (patientId, kind) =>
    doctorOrFamilyRequest(`/cognitive/patients/${patientId}/assignments${kind ? `?kind=${kind}` : ''}`),
  assignExercise: (patientId, data) =>
    doctorOrFamilyRequest(`/cognitive/patients/${patientId}/assignments/exercise`, { method: 'POST', body: data }),
  assignAlbum: (patientId, data) =>
    doctorOrFamilyRequest(`/cognitive/patients/${patientId}/assignments/album`, { method: 'POST', body: data }),
  updateAssignment: (assignmentId, data) =>
    doctorOrFamilyRequest(`/cognitive/assignments/${assignmentId}`, { method: 'PUT', body: data }),
  setAssignmentEnabled: (assignmentId, enabled) =>
    doctorOrFamilyRequest(`/cognitive/assignments/${assignmentId}/enabled`, { method: 'PUT', body: { enabled } }),
  deleteAssignment: (assignmentId) =>
    doctorOrFamilyRequest(`/cognitive/assignments/${assignmentId}`, { method: 'DELETE' }),

  // ── Schedules ──
  listSchedules: (patientId) => doctorOrFamilyRequest(`/cognitive/patients/${patientId}/schedules`),
  createSchedule: (patientId, data) =>
    doctorOrFamilyRequest(`/cognitive/patients/${patientId}/schedules`, { method: 'POST', body: data }),
  updateSchedule: (scheduleId, data) =>
    doctorOrFamilyRequest(`/cognitive/schedules/${scheduleId}`, { method: 'PUT', body: data }),
  setScheduleActive: (scheduleId, isActive) =>
    doctorOrFamilyRequest(`/cognitive/schedules/${scheduleId}/active`, { method: 'PUT', body: { isActive } }),
  deleteSchedule: (scheduleId) =>
    doctorOrFamilyRequest(`/cognitive/schedules/${scheduleId}`, { method: 'DELETE' }),

  // ── Patient experience (patient-pinned) ──
  getActivities: (patientId) => patientRequest(`/cognitive/patients/${patientId}/assignments`),

  // ── Sessions (patient plays; active token) ──
  startSession: (assignmentId) =>
    apiRequest('/cognitive/sessions/start', { method: 'POST', body: { assignmentId } }),
  startExisting: (sessionId) => apiRequest(`/cognitive/sessions/${sessionId}/start`, { method: 'POST' }),
  recordInteraction: (sessionId, interaction) =>
    apiRequest(`/cognitive/sessions/${sessionId}/interactions`, { method: 'POST', body: { interaction } }),
  completeSession: (sessionId, interactions) =>
    apiRequest(`/cognitive/sessions/${sessionId}/complete`, { method: 'POST', body: { interactions } }),
  abandonSession: (sessionId) => apiRequest(`/cognitive/sessions/${sessionId}/abandon`, { method: 'POST' }),
  getSession: (sessionId) => apiRequest(`/cognitive/sessions/${sessionId}`),
  getDueSessions: (patientId) => apiRequest(`/cognitive/patients/${patientId}/sessions/due`),
  getSessionHistory: (patientId, opts = {}) => {
    const qs = new URLSearchParams(opts).toString();
    return doctorOrFamilyRequest(`/cognitive/patients/${patientId}/sessions${qs ? `?${qs}` : ''}`);
  },

  // ── Analytics ──
  getAnalytics: (patientId, days = 30) =>
    doctorOrFamilyRequest(`/cognitive/patients/${patientId}/analytics?days=${days}`),
};

// ===== TOKEN MANAGEMENT =====
export const tokenManager = {
  /**
   * Each setter writes the USER_ROLE_KEY so apiRequest always knows
   * which role is currently active and picks the correct token.
   */
  setDoctorToken: (token) => {
    localStorage.setItem(USER_ROLE_KEY, 'doctor');
    localStorage.setItem(DOCTOR_TOKEN_KEY, token);
  },
  setFamilyToken: (token) => {
    localStorage.setItem(USER_ROLE_KEY, 'family');
    localStorage.setItem(FAMILY_TOKEN_KEY, token);
  },
  setPatientToken: (token) => {
    localStorage.setItem(USER_ROLE_KEY, 'patient');
    localStorage.setItem(PATIENT_TOKEN_KEY, token);
  },

  getDoctorToken:  () => localStorage.getItem(DOCTOR_TOKEN_KEY),
  getFamilyToken:  () => localStorage.getItem(FAMILY_TOKEN_KEY),
  getPatientToken: () => localStorage.getItem(PATIENT_TOKEN_KEY),

  clearDoctorToken:  () => localStorage.removeItem(DOCTOR_TOKEN_KEY),
  clearFamilyToken:  () => localStorage.removeItem(FAMILY_TOKEN_KEY),
  clearPatientToken: () => localStorage.removeItem(PATIENT_TOKEN_KEY),

  /** Remove all tokens AND the role marker on logout. */
  clearAllTokens: () => {
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(DOCTOR_TOKEN_KEY);
    localStorage.removeItem(FAMILY_TOKEN_KEY);
    localStorage.removeItem(PATIENT_TOKEN_KEY);
  },

  isAuthenticated: () => !!(
    localStorage.getItem(DOCTOR_TOKEN_KEY) ||
    localStorage.getItem(FAMILY_TOKEN_KEY) ||
    localStorage.getItem(PATIENT_TOKEN_KEY)
  ),

  /**
   * Returns the active role — reads USER_ROLE_KEY first (explicit, written
   * on every login).  Falls back to token presence for old sessions.
   */
  getUserType: () => {
    const role = localStorage.getItem(USER_ROLE_KEY);
    if (role === 'doctor' || role === 'family' || role === 'patient') return role;
    // Fallback for sessions predating this fix
    if (localStorage.getItem(DOCTOR_TOKEN_KEY))  return 'doctor';
    if (localStorage.getItem(FAMILY_TOKEN_KEY))  return 'family';
    if (localStorage.getItem(PATIENT_TOKEN_KEY)) return 'patient';
    return null;
  },
};

export default {
  doctorAuthAPI,
  familyAuthAPI,
  patientAuthAPI,
  patientsAPI,
  medicationsAPI,
  familyMedicationsAPI,
  aiMoodAPI,
  notificationsAPI,
  faceRecognitionAPI,
  locationAPI,
  dailyPlanAPI,
  cognitiveAPI,
  tokenManager,
};
