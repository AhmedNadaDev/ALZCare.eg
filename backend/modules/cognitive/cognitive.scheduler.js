/**
 * cognitive.scheduler.js
 *
 * Server-side scheduler for cognitive sessions. Same proven two-layer strategy
 * as the DailyPlan scheduler:
 *   Layer 1 — node-cron runs every minute, finds schedules due in the next 60s
 *             and arms a precise setTimeout for the exact HH:MM:00.
 *   Layer 2 — the timer fires, re-validates state, and creates a `scheduled`
 *             CognitiveSession (which emits `cognitive:session-due` over
 *             Socket.IO to the patient's room).
 *
 * A separate cron sweeps stale sessions (active→abandoned, scheduled→missed).
 * An in-memory map keyed by `${scheduleId}:${YYYY-MM-DD}` prevents
 * double-firing within a day; `lastTriggeredAt` provides restart-safe dedup.
 */

import cron from 'node-cron';
import CognitiveSchedule from './models/CognitiveSchedule.model.js';
import CognitiveAssignment from './models/CognitiveAssignment.model.js';
import sessionService from './services/cognitiveSession.service.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// `${scheduleId}:${dateKey}` → timeout handle
const timers = new Map();

const dateKey = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

const isSameDay = (a, b) => a && b && dateKey(a) === dateKey(b);

/** Milliseconds until HH:MM:00 today; null if outside the current cron window. */
const msUntil = (time) => {
  const [h, m] = time.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = target.getTime() - Date.now();
  if (diff >= -10_000 && diff <= 60_000) return Math.max(diff, 0);
  return null;
};

/** Does this schedule's recurrence make it due today? */
const isDueToday = (schedule, now = new Date()) => {
  switch (schedule.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
    case 'custom':
      return (schedule.daysOfWeek || []).includes(DAYS[now.getDay()]);
    case 'once':
      return schedule.date ? isSameDay(schedule.date, now) : false;
    default:
      return false;
  }
};

/** Fire a single schedule: re-validate and create a scheduled session. */
const fireSchedule = async (scheduleId) => {
  try {
    const schedule = await CognitiveSchedule.findById(scheduleId);
    if (!schedule || !schedule.isActive) return;
    if (isSameDay(schedule.lastTriggeredAt, new Date())) return; // already fired today

    const assignment = await CognitiveAssignment.findById(schedule.assignment);
    if (!assignment || !assignment.enabled) return;

    await sessionService.createScheduledSession({ assignment, schedule });

    schedule.lastTriggeredAt = new Date();
    if (schedule.recurrence === 'once') schedule.isActive = false; // one-and-done
    await schedule.save();

    console.log(`[Cognitive] Fired schedule "${schedule.title}" (${schedule.time}) for patient ${schedule.patient}`);
  } catch (err) {
    console.error('[Cognitive] fireSchedule error:', err.message);
  }
};

/** Arm a precise timer for a schedule if it is due within the cron window. */
const armTimer = (schedule) => {
  if (!schedule?.isActive) return;
  const now = new Date();
  if (!isDueToday(schedule, now)) return;
  if (isSameDay(schedule.lastTriggeredAt, now)) return;

  const key = `${schedule._id}:${dateKey(now)}`;
  if (timers.has(key)) return;

  const delay = msUntil(schedule.time);
  if (delay === null) return;

  const handle = setTimeout(() => {
    timers.delete(key);
    fireSchedule(schedule._id);
  }, delay);
  timers.set(key, handle);
  console.log(`[Cognitive] Armed "${schedule.title}" (${schedule.time}) in ${delay}ms`);
};

/** Cron scan: arm timers for all active schedules due in the next minute. */
const scanAndSchedule = async () => {
  try {
    const schedules = await CognitiveSchedule.find({ isActive: true });
    for (const schedule of schedules) armTimer(schedule);
  } catch (err) {
    console.error('[Cognitive] scan error:', err.message);
  }
};

const sweep = async () => {
  try {
    await sessionService.sweepStale();
  } catch (err) {
    console.error('[Cognitive] sweep error:', err.message);
  }
};

// ── Public API (used by the schedule service after mutations) ───────────────

/** Immediately (re)arm a freshly created/updated schedule. */
export const syncSchedule = (schedule) => armTimer(schedule);

/** Cancel any armed timers for a schedule (across all day-keys). */
export const cancelSchedule = (scheduleId) => {
  const prefix = `${scheduleId}:`;
  for (const [key, handle] of timers.entries()) {
    if (key.startsWith(prefix)) {
      clearTimeout(handle);
      timers.delete(key);
    }
  }
};

/** Start the cron jobs. Called from server.js once the DB is connected. */
export const startCognitiveScheduler = () => {
  cron.schedule('* * * * *', scanAndSchedule, { timezone: 'UTC' });
  cron.schedule('*/10 * * * *', sweep, { timezone: 'UTC' });
  console.log('[Cognitive] Scheduler started (scan every minute, sweep every 10 min)');

  // Restart recovery: catch anything already due and sweep stale state.
  scanAndSchedule();
  sweep();
};
