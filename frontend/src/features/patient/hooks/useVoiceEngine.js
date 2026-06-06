/**
 * useVoiceEngine — Real-time voice event engine for the patient dashboard.
 *
 * Architecture:
 *  • Connects to the Socket.IO server and joins room `patient:{patientId}`
 *  • Listens for server-emitted events:
 *      - 'event:trigger'    → server fired at exact scheduled time → show modal
 *      - 'dailyPlan:updated'→ plan was changed (family added/edited) → refresh UI
 *      - 'event:completed'  → event resolved → refresh UI
 *      - 'event:missed'     → event missed → refresh UI
 *  • Does a single HTTP fetch on mount for the initial plan snapshot
 *  • NO polling interval
 *
 * Returns:
 *   plan          – current DailyPlan object (or null)
 *   activeEvent   – event object with .planId set (or null)
 *   loading       – boolean
 *   dismissEvent  – () => void
 *   completeEvent – (result) => Promise<void>
 *   refreshPlan   – () => Promise<void>
 *   connected     – boolean (socket connection status)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { dailyPlanAPI } from '../../../modules/shared/api/api';
import { getSocket, joinPatientRoom } from '../../../modules/shared/socket/socketClient';

// Per-session set to avoid re-triggering an event whose modal was already shown
const triggered = new Set();

export const useVoiceEngine = (patientId) => {
  const [plan, setPlan]               = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [connected, setConnected]     = useState(false);
  const mountedRef                    = useRef(true);

  // ── Initial HTTP fetch ─────────────────────────────────────────────────────
  const fetchPlan = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await dailyPlanAPI.getToday(patientId);
      if (mountedRef.current) setPlan(res.data || null);
    } catch {
      if (mountedRef.current) setPlan(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [patientId]);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    mountedRef.current = true;

    fetchPlan(); // initial snapshot

    const socket = getSocket();
    joinPatientRoom(patientId);

    // Track connection status
    const onConnect    = () => { if (mountedRef.current) setConnected(true); };
    const onDisconnect = () => { if (mountedRef.current) setConnected(false); };
    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);

    // Server fires this at the exact scheduled second
    const onEventTrigger = ({ plan: planData, event: eventData } = {}) => {
      if (!mountedRef.current || !eventData) return;
      const key = eventData._id?.toString();
      if (!key || triggered.has(key)) return;

      console.log('[VoiceEngine] event:trigger received:', eventData.title);
      triggered.add(key);
      setActiveEvent({ ...eventData, planId: planData?._id });
    };

    // Any plan mutation → refresh the plan snapshot
    const onPlanUpdated = ({ plan: updatedPlan } = {}) => {
      if (!mountedRef.current) return;
      console.log('[VoiceEngine] dailyPlan:updated received');
      if (updatedPlan) {
        setPlan(updatedPlan);
      } else {
        fetchPlan();
      }
    };

    socket.on('event:trigger',     onEventTrigger);
    socket.on('dailyPlan:updated', onPlanUpdated);
    socket.on('event:completed',   onPlanUpdated);
    socket.on('event:missed',      onPlanUpdated);

    return () => {
      mountedRef.current = false;
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('event:trigger',    onEventTrigger);
      socket.off('dailyPlan:updated',onPlanUpdated);
      socket.off('event:completed',  onPlanUpdated);
      socket.off('event:missed',     onPlanUpdated);
    };
  }, [patientId, fetchPlan]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const dismissEvent = useCallback(() => setActiveEvent(null), []);

  const completeEvent = useCallback(async (_result) => {
    setActiveEvent(null);
    await fetchPlan(); // pull fresh statuses after response
  }, [fetchPlan]);

  return { plan, activeEvent, loading, connected, dismissEvent, completeEvent, refreshPlan: fetchPlan };
};
