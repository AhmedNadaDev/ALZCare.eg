import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - specify path explicitly for ES modules
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

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:3000'],
  credentials: true
}));
// Increase body size limit for face recognition images (base64 can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ALZCare Doctor Dashboard API is running' });
});

// API Routes - All isolated under /api/doctor and /api/family
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

// ML aliases (same handlers as existing face-recognition routes — backward compatible)
app.post('/api/ml/predict-person', (req, res, next) =>
  faceRecognitionController.recognizeFacePublic(req, res, next)
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
});

export default app;
