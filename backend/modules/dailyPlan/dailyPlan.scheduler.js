/**
 * dailyPlan.scheduler.js
 *
 * Server-side scheduler for the Voice Daily Care system.
 *
 * Strategy (two-layer):
 *  Layer 1 — node-cron runs every minute to detect newly-due events
 *             and schedule precise setTimeout timers for the exact second.
 *  Layer 2 — setTimeout fires at the exact HH:MM:00 mark and emits
 *             'event:trigger' via Socket.IO to the patient's room.
 *
 * In-memory map prevents double-scheduling the same event within a session.
 * On server restart the cron picks up any unprocessed pending events.
 */

import cron from 'node-cron';
import DailyPlan from './dailyPlan.model.js';
import Medication from '../../models/Medication.model.js';
import { emitToPatientRoom } from '../socket/socketManager.js';

// eventId → timeout handle   (prevents double-scheduling)
const scheduledEvents = new Map();

/**
 * Calculate milliseconds until HH:MM:00 today.
 * Returns null if the time has already passed by more than 60 s.
 */
const msUntil = (scheduledTime) => {
  const [h, m] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  const diff = target.getTime() - now.getTime();

  // Within next 60 s (cron fires every minute so anything ≤ 60 s is valid)
  // or up to 10 s in the past (handle tiny cron jitter)
  if (diff >= -10_000 && diff <= 60_000) return Math.max(diff, 0);
  return null;
};

/**
 * Schedule a single event for exact-time firing.
 */
const scheduleEvent = (plan, event) => {
  const key = event._id.toString();
  if (scheduledEvents.has(key)) return; // already scheduled

  const delay = msUntil(event.scheduledTime);
  if (delay === null) return; // not in the current minute window

  console.log(`[Scheduler] Scheduling "${event.title}" (${event.scheduledTime}) in ${delay}ms`);

  const handle = setTimeout(async () => {
    scheduledEvents.delete(key);

    // Re-fetch to make sure it's still pending (family may have updated it)
    try {
      const freshPlan = await DailyPlan.findById(plan._id)
        .populate('patientId', 'firstName lastName');
      const freshEvent = freshPlan?.events?.id(event._id);

      if (!freshEvent || freshEvent.status !== 'pending') {
        console.log(`[Scheduler] Event ${key} already resolved, skipping trigger`);
        return;
      }

      console.log(`[Scheduler] TRIGGER event "${freshEvent.title}" for patient ${plan.patientId}`);

      emitToPatientRoom(plan.patientId.toString(), 'event:trigger', {
        plan: {
          _id: freshPlan._id,
          patientId: freshPlan.patientId,
        },
        event: {
          _id: freshEvent._id,
          title: freshEvent.title,
          type: freshEvent.type,
          scheduledTime: freshEvent.scheduledTime,
          status: freshEvent.status,
          voicePrompt: freshEvent.voicePrompt,
          medicationId: freshEvent.medicationId,
        },
      });
    } catch (err) {
      console.error('[Scheduler] Error firing event trigger:', err.message);
    }
  }, delay);

  scheduledEvents.set(key, handle);
};

/**
 * Main scan: fetch all today's pending plans and schedule any events
 * whose scheduled time falls in the next 60 seconds.
 */
const scanAndSchedule = async () => {
  try {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);

    const plans = await DailyPlan.find({
      date: { $gte: start, $lte: end },
      'events.status': 'pending',
    }).populate('patientId', 'firstName lastName');

    let scheduled = 0;
    for (const plan of plans) {
      for (const event of plan.events) {
        if (event.status !== 'pending') continue;
        if (scheduledEvents.has(event._id.toString())) continue;
        scheduleEvent(plan, event);
        scheduled++;
      }
    }

    if (scheduled > 0) {
      console.log(`[Scheduler] Cron tick: scheduled ${scheduled} new event timer(s)`);
    }
  } catch (err) {
    console.error('[Scheduler] Scan error:', err.message);
  }
};

/**
 * Cancel all pending timers for a specific plan (called when plan is updated).
 * The next cron tick will re-schedule with fresh data.
 */
export const cancelPlanTimers = (plan) => {
  if (!plan?.events) return;
  for (const event of plan.events) {
    const key = event._id.toString();
    if (scheduledEvents.has(key)) {
      clearTimeout(scheduledEvents.get(key));
      scheduledEvents.delete(key);
      console.log(`[Scheduler] Cancelled timer for event ${key}`);
    }
  }
};

/**
 * Immediately schedule events for a freshly created/updated plan.
 * Called from the service after any mutation.
 */
export const scheduleForPlan = (plan) => {
  if (!plan?.events) return;
  for (const event of plan.events) {
    if (event.status === 'pending') scheduleEvent(plan, event);
  }
};

/**
 * Inject today's medication events for ALL active medications at midnight.
 *
 * This runs independently of the service layer to avoid circular imports
 * (service → scheduler → service).  Logic mirrors dailyPlanService.injectMedicationEvent.
 */
const injectDailyMedicationEvents = async () => {
  try {
    const now     = new Date();
    const start   = new Date(now); start.setHours(0, 0, 0, 0);
    const end     = new Date(now); end.setHours(23, 59, 59, 999);
    const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][now.getDay()];

    const medications = await Medication.find({ isActive: true }).lean();
    let injected = 0;

    for (const med of medications) {
      for (const slot of (med.schedule || [])) {
        if (!slot.days?.includes(dayName)) continue;

        // Skip if an event for this medication + time already exists today
        const existing = await DailyPlan.findOne({
          patientId: med.patient,
          date: { $gte: start, $lte: end },
          'events.medicationId': med._id,
          'events.scheduledTime': slot.time,
        });
        if (existing) continue;

        const event = {
          title:        `Take ${med.name}`,
          type:         'medication',
          scheduledTime: slot.time,
          status:       'pending',
          voicePrompt: {
            text:            `It's time to take your medication: ${med.name}. Did you take it?`,
            requireResponse: true,
          },
          medicationId: med._id,
        };

        let plan = await DailyPlan.findOne({
          patientId: med.patient,
          date: { $gte: start, $lte: end },
        });

        if (!plan) {
          plan = await DailyPlan.create({
            patientId:      med.patient,
            date:           start,
            events:         [event],
            createdBy:      med.prescribedBy,
            createdByModel: 'Doctor',
          });
        } else {
          plan.events.push(event);
          await plan.save();
        }

        // Schedule the newly inserted event immediately
        const newEvent = plan.events[plan.events.length - 1];
        scheduleEvent(plan, newEvent);

        emitToPatientRoom(med.patient.toString(), 'dailyPlan:updated', {
          plan: plan.toObject ? plan.toObject() : plan,
        });

        injected++;
      }
    }

    if (injected > 0) {
      console.log(`[Scheduler] Daily injection: ${injected} medication event(s) created for ${now.toDateString()}`);
    }
  } catch (err) {
    console.error('[Scheduler] Daily medication injection error:', err.message);
  }
};

/**
 * Start the cron job. Called from server.js once DB is connected.
 */
export const startDailyPlanScheduler = () => {
  // Runs at second 0 of every minute — fires scheduled voice events
  cron.schedule('* * * * *', scanAndSchedule, { timezone: 'UTC' });
  console.log('[Scheduler] Daily plan scheduler started (cron every minute)');

  // Runs at midnight every day — injects today's medication events into DailyPlan
  cron.schedule('0 0 * * *', injectDailyMedicationEvents, { timezone: 'UTC' });
  console.log('[Scheduler] Daily medication injection scheduled (midnight UTC)');

  // Immediate first scan for pending events (server restart recovery)
  scanAndSchedule();

  // Also run injection now in case today's events haven't been created yet
  // (handles first-run or medication created before scheduler started).
  injectDailyMedicationEvents();
};
