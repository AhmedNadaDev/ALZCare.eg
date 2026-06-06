import { Router } from 'express';
import controller from './dailyPlan.controller.js';
import { protectDoctorOrFamily } from '../../middlewares/familyAuth.middleware.js';

// ── Family / Doctor routes ────────────────────────────────────────────────────
export const familyDailyPlanRouter = Router();

// All family/doctor plan management uses protectDoctorOrFamily
// (ownership is validated inside the service via req.patientId)
familyDailyPlanRouter.post('/', protectDoctorOrFamily, controller.upsertDailyPlan.bind(controller));
familyDailyPlanRouter.post('/events', protectDoctorOrFamily, controller.addEvents.bind(controller));
familyDailyPlanRouter.put('/:planId/event/:eventId', protectDoctorOrFamily, controller.updateEvent.bind(controller));
familyDailyPlanRouter.delete('/:planId/event/:eventId', protectDoctorOrFamily, controller.deleteEvent.bind(controller));
familyDailyPlanRouter.put('/:planId/event/:eventId/manual', protectDoctorOrFamily, controller.manualConfirmEvent.bind(controller));

// ── Patient / shared routes ───────────────────────────────────────────────────
export const patientDailyPlanRouter = Router();

// Get today's plan (called by patient dashboard)
patientDailyPlanRouter.get('/:id/daily-plan/today', protectDoctorOrFamily, controller.getTodayPlan.bind(controller));

// Get plan by date (family / doctor view)
patientDailyPlanRouter.get('/:id/daily-plan', protectDoctorOrFamily, controller.getPlanByDate.bind(controller));

// ── Event response routes (used by voice engine) ──────────────────────────────
export const eventResponseRouter = Router();

// Patient voice response
eventResponseRouter.post('/:planId/event/:eventId/respond', protectDoctorOrFamily, controller.respondToEvent.bind(controller));
