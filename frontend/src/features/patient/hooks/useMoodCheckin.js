/**
 * useMoodCheckin.js
 *
 * Listens for the 'mood:checkin' Socket.IO event emitted by the backend
 * scheduler when any of the patient's scheduled time slots fires.
 *
 * Deduplication:
 *   Per-session Set keyed by  `{YYYY-MM-DD}:{scheduledTime}`
 *   This lets each daily TIME SLOT show exactly once per calendar day,
 *   while allowing multiple different slots (09:00, 14:00, 20:00) to each
 *   trigger their own modal independently.
 *
 * Returns:
 *   activeCheckin  — socket payload for the current check-in (or null)
 *   dismissCheckin — close the modal without submitting
 *   checkinDone    — called by MoodCheckinModal after successful submission
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, joinPatientRoom } from '../../../modules/shared/socket/socketClient';

// Module-level Set: survives re-renders, resets on full page reload.
// Key: `YYYY-MM-DD:HH:MM`  (one slot per day can show once)
const shownSlots = new Set();

/** Reset the daily set when the calendar date rolls over. */
let lastResetDate = new Date().toDateString();
const resetIfNewDay = () => {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    shownSlots.clear();
    lastResetDate = today;
    console.log('[useMoodCheckin] New day detected — cleared dedup set');
  }
};

export const useMoodCheckin = (patientId) => {
  const [activeCheckin, setActiveCheckin] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!patientId) return;

    console.log(`[useMoodCheckin] Subscribing to mood:checkin for patient ${patientId}`);

    const socket = getSocket();
    joinPatientRoom(patientId);

    const onMoodCheckin = (payload = {}) => {
      if (!mountedRef.current) {
        console.log('[useMoodCheckin] onMoodCheckin: unmounted — skip');
        return;
      }

      resetIfNewDay();

      // Build composite dedup key: date + scheduled time slot
      const today    = new Date().toDateString();
      const slotTime = payload.scheduledTime || 'manual';
      const key      = `${today}:${slotTime}`;

      console.log(`[useMoodCheckin] mood:checkin received | key="${key}" | payload:`, payload);

      if (shownSlots.has(key)) {
        console.log(`[useMoodCheckin] Slot "${key}" already shown today — skipping`);
        return;
      }

      // If another modal is currently active (unlikely but possible), queue this
      // by waiting. For simplicity we do NOT queue — the patient will get the
      // current slot and the next one will fire via the next cron tick.
      if (activeCheckin) {
        console.warn('[useMoodCheckin] Another check-in is active — dismissing it for new slot');
      }

      shownSlots.add(key);
      console.log(`[useMoodCheckin] Opening MoodCheckinModal for slot "${slotTime}"`);
      setActiveCheckin(payload);
    };

    socket.on('mood:checkin', onMoodCheckin);
    return () => {
      socket.off('mood:checkin', onMoodCheckin);
      console.log(`[useMoodCheckin] Unsubscribed mood:checkin for patient ${patientId}`);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const dismissCheckin = useCallback(() => {
    console.log('[useMoodCheckin] dismissCheckin()');
    setActiveCheckin(null);
  }, []);

  const checkinDone = useCallback((result) => {
    console.log('[useMoodCheckin] checkinDone() — mood:', result?.mood, 'arousal:', result?.arousal);
    setActiveCheckin(null);
  }, []);

  return { activeCheckin, dismissCheckin, checkinDone };
};
