import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Route imports
import doctorAuthRoutes from './routes/doctorAuth.routes.js';
import familyAuthRoutes from './routes/familyAuth.routes.js';
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import medicationRoutes from './routes/medication.routes.js';
import familyMedicationRoutes from './routes/familyMedication.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import faceRecognitionRoutes, { faceRecognitionPublicRoutes } from './routes/faceRecognition.routes.js';
import faceRecognitionController from './controllers/faceRecognition.controller.js';
import chatbotRoutes from './modules/chatbot/node_client/chatbot.routes.js';
import { patientLocationRouter, familyLocationRouter } from './modules/location/location.routes.js';
import safetyZoneRoutes from './modules/safetyZone/safetyZone.routes.js';
import {
  familyDailyPlanRouter,
  patientDailyPlanRouter,
  eventResponseRouter
} from './modules/dailyPlan/dailyPlan.routes.js';
import aiMoodRoutes from './modules/aiMood/aiMood.routes.js';
import { cognitiveRouter, startCognitiveScheduler, seedExerciseTemplates } from './modules/cognitive/index.js';

// Socket.IO + schedulers
import { initIO } from './modules/socket/socketManager.js';
import { startDailyPlanScheduler } from './modules/dailyPlan/dailyPlan.scheduler.js';
import { startMoodCheckinScheduler } from './modules/aiMood/moodCheckin.scheduler.js';

// Models needed for counter seeding
import Patient from './models/Patient.model.js';
import Counter from './models/Counter.model.js';

const app = express();
const httpServer = createServer(app);

// ── CORS origins ─────────────────────────────────────────────────────────────
// CORS_ORIGINS env var: comma-separated list of allowed origins.
// In production/ngrok add your ngrok https URL there.
const BASE_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
];
const EXTRA_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
const ALLOWED_ORIGINS = [...new Set([...BASE_ORIGINS, ...EXTRA_ORIGINS])];
console.log('[CORS] Allowed origins:', ALLOWED_ORIGINS);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ALZCare API is running', realtime: true });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/doctor/auth', doctorAuthRoutes);
app.use('/api/family/auth', familyAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/doctor/patients', patientRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/family/medications', familyMedicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/family/face-recognition', faceRecognitionRoutes);
app.use('/api/face-recognition', faceRecognitionPublicRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/patient/location', patientLocationRouter);
app.use('/api/family/location', familyLocationRouter);
app.use('/api/family/safety-zone', safetyZoneRoutes);
app.use('/api/family/daily-plan', familyDailyPlanRouter);
app.use('/api/patient', patientDailyPlanRouter);
app.use('/api/daily-plan', eventResponseRouter);
app.use('/api/mood-checkin', aiMoodRoutes);
app.use('/api/cognitive', cognitiveRouter);

app.post('/api/ml/predict-person', (req, res, next) =>
  faceRecognitionController.recognizeFacePublic(req, res, next)
);

// ── Serve built frontend (SPA) ────────────────────────────────────────────────
// When the built dist/ folder exists Express serves it directly.
// This means the ngrok tunnel (which points at port 5001) serves BOTH the API
// and the React app — no second tunnel needed.
const DIST_PATH = path.join(__dirname, '../frontend/dist');
app.use(express.static(DIST_PATH));

// SPA catch-all: every non-API, non-socket, non-uploads path gets index.html
// so React Router handles client-side navigation.
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/uploads/') ||
    req.path.startsWith('/socket.io/')
  ) {
    return next();
  }
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

// ── Error handler (must come after all routes) ────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

/**
 * Seed the patientNumber counter to the highest existing sequence so that
 * newly generated numbers never collide with patients created before this fix.
 */
async function seedPatientNumberCounter() {
  const last = await Patient.findOne(
    { patientNumber: /^ALZ-\d+$/ },
    { patientNumber: 1 }
  ).sort({ patientNumber: -1 });

  if (last?.patientNumber) {
    const match = last.patientNumber.match(/ALZ-(\d+)/);
    if (match) {
      const currentMax = parseInt(match[1], 10);
      await Counter.ensureMinimum('patientNumber', currentMax);
      console.log(`[Counter] patientNumber counter seeded to ${currentMax} (last: ${last.patientNumber})`);
    }
  } else {
    console.log('[Counter] No existing patients found — counter will start at 1');
  }
}

connectDB()
  .then(async () => {
    // 1. Ensure the atomic counter is in sync with existing data
    await seedPatientNumberCounter();

    // 1b. Seed the cognitive exercise template catalogue (idempotent)
    await seedExerciseTemplates();

    // 2. Attach Socket.IO to the http server
    initIO(httpServer);

    // 3. Start the server-side cron schedulers
    startDailyPlanScheduler();
    startMoodCheckinScheduler();
    startCognitiveScheduler();

    // 4. Listen
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║         ALZCare Backend — STARTED                ║');
      console.log('╚══════════════════════════════════════════════════╝');
      console.log(`[Server]  Port        : ${PORT}`);
      console.log(`[Server]  Health      : http://localhost:${PORT}/api/health`);
      console.log(`[Server]  Socket.IO   : ws://localhost:${PORT}`);
      console.log(`[Server]  CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
      console.log(`[Server]  Mood svc URL: ${process.env.MOOD_SERVICE_URL || process.env.EMOTION_SERVICE_URL || 'http://localhost:8001'}`);
      console.log('');
      console.log('[Server]  For Ngrok mobile testing:');
      console.log('[Server]  1. ngrok http 5001');
      console.log('[Server]  2. Copy https URL → add to backend/.env CORS_ORIGINS=<url>');
      console.log('[Server]  3. Copy https URL → add to frontend/.env.local: VITE_API_URL=<url> VITE_SOCKET_URL=<url>');
      console.log('[Server]  4. Restart both servers');
      console.log('');
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });

export default app;
