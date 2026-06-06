/**
 * moodCheckin.scheduler.js
 *
 * Fires 'mood:checkin' Socket.IO events at each of a patient's scheduled times.
 *
 * Strategy (identical to dailyPlan.scheduler.js):
 *   • node-cron fires every minute
 *   • For each active MoodSchedule document, iterate over scheduledTimes[]
 *   • If a slot's time falls within the next 60 s, schedule a setTimeout for it
 *   • In-memory Map deduplicates on composite key  `{patientId}:{HH:MM}`
 *   • Midnight cron clears the Map so every slot fires once the next day
 *
 * Critical fixes vs v1:
 *   1. Dedup key is  `patientId:time`  (not just `patientId`) — multiple slots work
 *   2. Null-guard on schedule.patientId (handles orphan docs if patient deleted)
 *   3. Full console tracing at each step
 */

import cron from 'node-cron';
import MoodSchedule from './MoodSchedule.model.js';
import { emitToPatientRoom } from '../socket/socketManager.js';

// Composite key: `${patientId}:${HH:MM}` → true
const triggeredToday = new Map();

// setTimeout handles keyed the same way — prevents double-scheduling within
// the same cron tick if scanAndSchedule is called more than once.
const pendingTimers = new Map();

const LOG = '[MoodCheckin]';

// ── Time math ─────────────────────────────────────────────────────────────────
/**
 * Returns ms until HH:MM today (0 if already due within the last 10 s).
 * Returns null if the time is outside this cron-minute window.
 */
const msUntil = (scheduledTime) => {
  const [h, m] = scheduledTime.split(':').map(Number);
  const now    = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  const diff = target.getTime() - now.getTime();
  if (diff >= -10_000 && diff <= 60_000) return Math.max(diff, 0);
  return null;
};

// ── Core scan ─────────────────────────────────────────────────────────────────
const scanAndSchedule = async () => {
  try {
    const activeSchedules = await MoodSchedule.find({ isActive: true })
      .populate('patientId', 'firstName lastName')
      .lean();

    let scheduled = 0;

    for (const schedule of activeSchedules) {
      // Guard: skip orphan docs where the patient was deleted
      if (!schedule.patientId || !schedule.patientId._id) {
        console.warn(`${LOG} Orphan MoodSchedule _id=${schedule._id} — patientId not found`);
        continue;
      }

      const patientId   = schedule.patientId._id.toString();
      const patientName = `${schedule.patientId.firstName} ${schedule.patientId.lastName}`;

      // Iterate over all time slots — multi-slot support
      const times = schedule.scheduledTimes || [];

      for (const slotTime of times) {
        const compositeKey = `${patientId}:${slotTime}`;

        // Already triggered today for this slot → skip
        if (triggeredToday.has(compositeKey)) continue;

        // Already has a pending timer for this slot → skip
        if (pendingTimers.has(compositeKey)) continue;

        const delay = msUntil(slotTime);
        if (delay === null) continue;

        console.log(
          `${LOG} Scheduling slot ${slotTime} for ${patientName} (${patientId}) in ${delay}ms`
        );

        const handle = setTimeout(() => {
          pendingTimers.delete(compositeKey);
          triggeredToday.set(compositeKey, true);

          console.log(`${LOG} TRIGGER mood:checkin  patient=${patientId}  time=${slotTime}`);

          emitToPatientRoom(patientId, 'mood:checkin', {
            scheduledTime: slotTime,
            patientName,
            prompt: `Hello ${schedule.patientId.firstName}, I am the ALZCare system. How are you feeling today?`,
          });
        }, delay);

        pendingTimers.set(compositeKey, handle);
        scheduled++;
      }
    }

    if (scheduled > 0) {
      console.log(`${LOG} Cron tick: scheduled ${scheduled} new slot timer(s)`);
    }
  } catch (err) {
    console.error(`${LOG} scanAndSchedule error:`, err.message, err.stack);
  }
};

// ── Midnight reset ────────────────────────────────────────────────────────────
const resetDailyTriggers = () => {
  const trigCount  = triggeredToday.size;
  const timerCount = pendingTimers.size;

  // Cancel any stale pending timers (e.g. if the server ran past midnight)
  for (const handle of pendingTimers.values()) clearTimeout(handle);
  pendingTimers.clear();
  triggeredToday.clear();

  if (trigCount + timerCount > 0) {
    console.log(
      `${LOG} Midnight reset — cleared ${trigCount} trigger(s) and ${timerCount} pending timer(s)`
    );
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/** Start the cron job — call once from server.js after DB connect. */
export const startMoodCheckinScheduler = () => {
  cron.schedule('* * * * *', scanAndSchedule, { timezone: 'UTC' });
  cron.schedule('0 0 * * *', resetDailyTriggers, { timezone: 'UTC' });

  console.log(`${LOG} Scheduler started (cron every minute, midnight reset)`);

  // Immediate scan on startup so slots within the first minute are caught
  scanAndSchedule();
};

/**
 * Clear all today-trigger locks for a patient.
 * Call this after setSchedule so updated/new times can fire the same day.
 *
 * @param {string|ObjectId} patientId
 */
export const rescheduleForPatient = (patientId) => {
  const pid = patientId.toString();

  // Cancel any pending timers for this patient
  for (const [key, handle] of pendingTimers.entries()) {
    if (key.startsWith(`${pid}:`)) {
      clearTimeout(handle);
      pendingTimers.delete(key);
      console.log(`${LOG} Cancelled pending timer: ${key}`);
    }
  }

  // Clear triggered flags
  for (const key of triggeredToday.keys()) {
    if (key.startsWith(`${pid}:`)) {
      triggeredToday.delete(key);
      console.log(`${LOG} Cleared trigger lock: ${key}`);
    }
  }

  console.log(`${LOG} rescheduleForPatient(${pid}) done — next cron tick will reschedule`);
};
