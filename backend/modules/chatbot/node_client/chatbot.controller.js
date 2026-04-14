import mongoose from 'mongoose';
import Patient from '../../../models/Patient.model.js';
import { askChatbot } from './chatbot.service.js';

/**
 * POST /api/chatbot/ask
 *
 * Modes:
 *   patient_id provided → PATIENT MODE (doctor) or FAMILY MODE (family)
 *   patient_id omitted  → GENERAL MODE (both roles allowed)
 *
 * Access control (enforced only when patient_id is present):
 *   doctor → may only access patients under their care
 *   family → may only access their single linked patient
 */
export const askQuestion = async (req, res, next) => {
  try {
    const { question, patient_id } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'question is required.' });
    }

    // ── patient_id is OPTIONAL ───────────────────────────────────────────
    let resolvedPatientId = null;

    if (patient_id) {
      if (!mongoose.Types.ObjectId.isValid(patient_id)) {
        return res.status(400).json({ success: false, message: 'Invalid patient_id format.' });
      }

      if (req.userRole === 'family') {
        const authorizedId = req.patientId?.toString();
        if (patient_id !== authorizedId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only ask about your linked patient.',
          });
        }
      } else if (req.userRole === 'doctor') {
        const patient = await Patient.findOne({
          _id: patient_id,
          doctor: req.doctor._id,
        }).lean();
        if (!patient) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Patient not found or not under your care.',
          });
        }
      }

      resolvedPatientId = patient_id;
    }

    // ── Per-user session key for general conversations ───────────────────
    const sessionId = req.user?._id?.toString() ?? 'general';

    // ── Map Node role → Python role ──────────────────────────────────────
    const userRole = req.userRole === 'family' ? 'family' : 'doctor';

    // ── Call Python AI service ───────────────────────────────────────────
    const result = await askChatbot(
      question.trim(),
      resolvedPatientId,
      sessionId,
      userRole,
    );

    return res.status(200).json({
      success: true,
      answer:   result.answer,
      mode:     result.mode,
      sources:  result.sources  ?? null,
      metadata: result.metadata ?? null,
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please try again later.',
      });
    }
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: error.response.data?.detail || 'AI service returned an error.',
      });
    }
    next(error);
  }
};
