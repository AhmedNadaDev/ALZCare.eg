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
import moodRoutes from './routes/mood.routes.js';
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

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:3000'],
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
app.use('/api/moods', moodRoutes);
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

// ── Error handlers ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
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
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Socket.IO  : ws://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });

export default app;
