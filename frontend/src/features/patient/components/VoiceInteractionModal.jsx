import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildVoiceMessage, speak, startListening } from '../utils/voiceUtils';
import { dailyPlanAPI } from '../../../modules/shared/api/api';

// ── SVG Icons — responsive size via Tailwind classes ─────────────────────────
const MicIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const SpeakerIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────────
const RESPONSE_TIMEOUT_MS = 60_000;
const STT_WINDOW_MS       = 11_000;
const TYPE_EMOJIS = { wake_up: '🌅', medication: '💊', appointment: '🏥', custom: '📌' };
const PHASE       = { SPEAKING: 'speaking', LISTENING: 'listening', PROCESSING: 'processing', DONE: 'done' };

const FEEDBACK_MAP = {
  mark_completed: 'Great! I have marked that as done. Well done!',
  mark_missed:    'Okay, I have noted that. Please take your medication as soon as you can.',
  alert_family:   'I hear that you are not feeling well. I will let your family know right away.',
};

const OUTCOME = {
  mark_completed: {
    icon:     <CheckIcon />,
    ring:     'border-green-500/50 bg-green-500/10 text-green-400',
    title:    'All done! 🎉',
    subtitle: 'Response recorded.',
  },
  alert_family: {
    icon:     <BellIcon />,
    ring:     'border-orange-500/50 bg-orange-500/10 text-orange-400',
    title:    'Family notified 💙',
    subtitle: 'Your family has been alerted.',
  },
  mark_missed: {
    icon:     <XIcon />,
    ring:     'border-red-500/50 bg-red-500/10 text-red-400',
    title:    'No response',
    subtitle: 'Event marked as missed.',
  },
  ask_again: {
    icon:     <XIcon />,
    ring:     'border-red-500/50 bg-red-500/10 text-red-400',
    title:    'Could not understand',
    subtitle: 'Event marked as missed.',
  },
};

// ── Countdown progress bar ─────────────────────────────────────────────────────
const CountdownBar = ({ seconds, total = 60 }) => {
  const pct      = Math.max(0, (seconds / total) * 100);
  const isUrgent = seconds <= 10;
  const isWarn   = seconds <= 20 && seconds > 10;

  const barColor = isUrgent ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-purple-500';
  const numColor = isUrgent ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-purple-300';

  return (
    <div className="w-full space-y-1 xs:space-y-2">
      <div className="flex items-center justify-between px-0.5 xs:px-1">
        <span className="text-[10px] xs:text-xs text-gray-500 uppercase tracking-wider">Time remaining</span>
        <span className={`text-sm xs:text-xl font-bold font-mono tabular-nums ${numColor}`}>
          {String(seconds).padStart(2, '0')}s
        </span>
      </div>
      <div className="h-2 xs:h-2.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Waveform animation — 8 bars on watch, 12 on xs+ ───────────────────────────
const Waveform = () => (
  <div className="flex justify-center items-end gap-[3px] xs:gap-[3px] h-8 xs:h-10">
    {[5, 9, 15, 22, 16, 9, 5, 13, 20, 13, 7, 17].map((h, i) => (
      <div
        key={i}
        className={`w-[4px] xs:w-[5px] bg-red-400/75 rounded-full animate-bounce ${i >= 8 ? 'hidden xs:block' : ''}`}
        style={{ height: `${h}px`, animationDelay: `${i * 0.07}s`, animationDuration: '0.65s' }}
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// VoiceInteractionModal
//
// Responsive layout:
//   watch (< 480px) — compact padding, smaller icons, 8 waveform bars,
//                     larger tap targets on manual confirm buttons
//   xs+  (≥ 480px) — standard spacing and full icon sizes
// ─────────────────────────────────────────────────────────────────────────────
const VoiceInteractionModal = ({ event, patientName, planId, onComplete, onDismiss }) => {
  const [phase, setPhase]               = useState(PHASE.SPEAKING);
  const [transcript, setTranscript]     = useState('');
  const [actionResult, setActionResult] = useState(null);
  const [countdown, setCountdown]       = useState(60);

  const mountedRef           = useRef(true);
  const respondedRef         = useRef(false);
  const responseTimerRef     = useRef(null);
  const countdownIntervalRef = useRef(null);
  const recognitionRef       = useRef(null);
  const startSTTRef          = useRef(null);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.speechSynthesis?.cancel();
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      clearTimeout(responseTimerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // ── handleMissed — 60 s deadline expired ─────────────────────────────────
  const handleMissed = useCallback(async () => {
    if (!mountedRef.current || respondedRef.current) {
      console.log('[Modal] handleMissed: already responded or unmounted — skip');
      return;
    }
    respondedRef.current = true;
    window.speechSynthesis?.cancel();
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    clearInterval(countdownIntervalRef.current);

    console.log('[Modal] ⏰ 60 s deadline — marking event as missed');
    try {
      await dailyPlanAPI.manualConfirm(planId, event._id, 'missed');
      console.log('[Modal] manualConfirm(missed) → success');
    } catch (err) {
      console.error('[Modal] manualConfirm(missed) API error:', err.message);
    }

    if (mountedRef.current) onComplete({ action: 'mark_missed', source: 'timeout' });
  }, [planId, event._id, onComplete]);

  // ── startGlobalTimer — 60 s window ───────────────────────────────────────
  const startGlobalTimer = useCallback(() => {
    let remaining = 60;
    setCountdown(60);

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (mountedRef.current) setCountdown(remaining);
      if (remaining <= 0) clearInterval(countdownIntervalRef.current);
    }, 1000);

    responseTimerRef.current = setTimeout(() => {
      clearInterval(countdownIntervalRef.current);
      handleMissed();
    }, RESPONSE_TIMEOUT_MS);

    console.log('[Modal] 60 s global timer started');
  }, [handleMissed]);

  // ── submitResponse ────────────────────────────────────────────────────────
  const submitResponse = useCallback(async (text) => {
    if (!mountedRef.current) { console.log('[Modal] submitResponse: unmounted — skip'); return; }
    if (respondedRef.current) { console.log('[Modal] submitResponse: already responded — skip'); return; }

    respondedRef.current = true;
    clearTimeout(responseTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    console.log(`[Modal] submitResponse: text="${text}"`);
    setTranscript(text);
    setPhase(PHASE.PROCESSING);

    try {
      console.log(`[Modal] → calling respondToEvent(planId=${planId}, eventId=${event._id})`);
      const res = await dailyPlanAPI.respondToEvent(planId, event._id, text, null);
      if (!mountedRef.current) { console.log('[Modal] submitResponse: unmounted after API call'); return; }

      const data   = res?.data ?? res;
      const action = data?.action;

      console.log(`[Modal] ✅ respondToEvent response: action=${action} intent=${data?.intent} confidence=${data?.confidence}`);

      if (!action || !OUTCOME[action]) {
        console.warn(`[Modal] Unknown action "${action}" — falling back to mark_missed`);
        setActionResult({ action: 'mark_missed' });
        setPhase(PHASE.DONE);
        onComplete({ action: 'mark_missed', source: 'unknown_action' });
        return;
      }

      setActionResult(data);
      setPhase(PHASE.DONE);

      const feedbackText = FEEDBACK_MAP[action] || 'Thank you for responding.';
      console.log(`[Modal] Speaking feedback: "${feedbackText}"`);
      await speak(feedbackText, { rate: 0.88 });
      if (!mountedRef.current) return;

      console.log('[Modal] onComplete called with action:', action);
      onComplete(data);

    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[Modal] ❌ submitResponse API error:', err.message, err);

      try {
        await dailyPlanAPI.manualConfirm(planId, event._id, 'missed');
        console.log('[Modal] fallback manualConfirm(missed) → success');
      } catch (fallbackErr) {
        console.error('[Modal] fallback manualConfirm error:', fallbackErr.message);
      }

      if (!mountedRef.current) return;
      setActionResult({ action: 'mark_missed' });
      setPhase(PHASE.DONE);
      onComplete({ action: 'mark_missed', source: 'api_error' });
    }
  }, [planId, event._id, onComplete]);

  // ── startSTT ──────────────────────────────────────────────────────────────
  const startSTT = useCallback(() => {
    if (!mountedRef.current || respondedRef.current) {
      console.log('[Modal] startSTT: skip (unmounted or already responded)');
      return;
    }
    console.log('[Modal] startSTT: starting recognition');

    recognitionRef.current = startListening(
      (text) => {
        if (respondedRef.current) {
          console.log('[Modal] STT onResult: already responded — ignoring late result');
          return;
        }
        console.log(`[Modal] STT onResult: "${text}"`);
        submitResponse(text);
      },
      (errMsg) => {
        if (!mountedRef.current || respondedRef.current) return;
        console.log(`[Modal] STT no result (${errMsg}) — restarting within 60 s window`);
        setTimeout(() => {
          if (mountedRef.current && !respondedRef.current) startSTTRef.current?.();
        }, 300);
      },
      STT_WINDOW_MS
    );
  }, [submitResponse]);

  useEffect(() => { startSTTRef.current = startSTT; }, [startSTT]);

  // ── Manual confirm ────────────────────────────────────────────────────────
  const handleManualConfirm = useCallback(async (status) => {
    if (respondedRef.current) return;
    respondedRef.current = true;

    clearTimeout(responseTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    console.log(`[Modal] manual confirm: ${status}`);
    try {
      await dailyPlanAPI.manualConfirm(planId, event._id, status);
    } catch (err) {
      console.error('[Modal] manualConfirm error:', err.message);
    }

    if (!mountedRef.current) return;
    const action = status === 'completed' ? 'mark_completed' : 'mark_missed';
    setActionResult({ action });
    setPhase(PHASE.DONE);
    onComplete({ action, source: 'manual' });
  }, [planId, event._id, onComplete]);

  // ── Main flow ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      if (!mountedRef.current) return;
      setPhase(PHASE.SPEAKING);

      const message = buildVoiceMessage(event, patientName);
      console.log('[Modal] 🔊 Speaking prompt:', message);

      startGlobalTimer();
      await speak(message, { rate: 0.88 });

      if (!mountedRef.current) { console.log('[Modal] unmounted after TTS'); return; }
      if (respondedRef.current) { console.log('[Modal] already responded during TTS'); return; }

      if (event?.voicePrompt?.requireResponse !== false) {
        console.log('[Modal] 🎤 switching to LISTENING phase');
        setPhase(PHASE.LISTENING);
        startSTT();
      } else {
        clearTimeout(responseTimerRef.current);
        clearInterval(countdownIntervalRef.current);
        respondedRef.current = true;
        const result = { action: 'mark_completed', intent: 'no_response_required' };
        setActionResult(result);
        setPhase(PHASE.DONE);
        onComplete(result);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outcome       = OUTCOME[actionResult?.action] ?? OUTCOME.mark_missed;
  const isActivePhase = phase === PHASE.SPEAKING || phase === PHASE.LISTENING;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 xs:p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d0620] border border-white/10 rounded-2xl xs:rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-8px)] xs:max-h-[calc(100dvh-24px)] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center gap-2 xs:gap-3 px-3 xs:px-5 sm:px-6 py-2.5 xs:py-3.5 sm:py-4 bg-white/[0.03] border-b border-white/[0.06] sticky top-0 z-10">
          <span className="text-lg xs:text-2xl flex-shrink-0 select-none">{TYPE_EMOJIS[event?.type] || '📌'}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm xs:text-base sm:text-lg font-bold text-white leading-tight truncate">{event?.title}</h2>
            <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5">{event?.scheduledTime} · ALZCare</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-3 xs:px-5 sm:px-6 pt-4 xs:pt-6 sm:pt-8 pb-3 xs:pb-5 sm:pb-6 space-y-3 xs:space-y-4 sm:space-y-6">

          {/* SPEAKING */}
          {phase === PHASE.SPEAKING && (
            <div className="space-y-3 xs:space-y-5 sm:space-y-6 text-center">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-2 xs:-inset-4 rounded-full border border-purple-400/10 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute -inset-1 xs:-inset-2 rounded-full border border-purple-400/15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
                  <div className="relative h-14 w-14 xs:h-20 xs:w-20 rounded-full bg-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center">
                    <SpeakerIcon />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">Speaking…</p>
                <p className="text-gray-400 text-xs xs:text-sm mt-1 xs:mt-2 leading-relaxed max-w-xs mx-auto">
                  {event?.voicePrompt?.text}
                </p>
              </div>
              <CountdownBar seconds={countdown} />
            </div>
          )}

          {/* LISTENING */}
          {phase === PHASE.LISTENING && (
            <div className="space-y-3 xs:space-y-4 sm:space-y-5 text-center">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-2 xs:-inset-4 rounded-full border border-red-400/10 animate-ping" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute -inset-1 xs:-inset-2 rounded-full border border-red-400/15 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                  <div className="relative h-14 w-14 xs:h-20 xs:w-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center animate-pulse">
                    <MicIcon />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">Listening…</p>
                <p className="text-gray-400 text-xs xs:text-sm mt-1">Please speak your response now</p>
              </div>
              <Waveform />
              <CountdownBar seconds={countdown} />
            </div>
          )}

          {/* PROCESSING */}
          {phase === PHASE.PROCESSING && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className="h-14 w-14 xs:h-20 xs:w-20 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
                  <div className="w-7 h-7 xs:w-9 xs:h-9 border-[3px] border-blue-500/25 border-t-blue-400 rounded-full animate-spin" />
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">Processing…</p>
                {transcript && (
                  <p className="text-gray-300 mt-2 text-xs xs:text-base italic leading-snug max-w-xs mx-auto">
                    "{transcript}"
                  </p>
                )}
                <p className="text-gray-500 text-[10px] xs:text-xs mt-1.5 xs:mt-2 uppercase tracking-wider">
                  AI is analysing your response
                </p>
              </div>
            </div>
          )}

          {/* DONE */}
          {phase === PHASE.DONE && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className={`h-14 w-14 xs:h-20 xs:w-20 rounded-full border-2 flex items-center justify-center ${outcome.ring}`}>
                  {outcome.icon}
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">{outcome.title}</p>
                <p className="text-gray-400 text-xs xs:text-sm mt-0.5 xs:mt-1">{outcome.subtitle}</p>
                {transcript && (
                  <p className="text-gray-500 mt-2 text-xs xs:text-sm italic max-w-xs mx-auto">
                    "{transcript}"
                  </p>
                )}
              </div>
              {/* Large tap target for watch */}
              <button
                onClick={onDismiss}
                className="w-full py-3.5 xs:py-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl xs:rounded-2xl text-white font-semibold text-sm xs:text-base sm:text-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ── Manual confirm buttons — only during active (speaking/listening) phases ── */}
          {isActivePhase && (
            <div className="space-y-1.5 xs:space-y-2 pt-2 xs:pt-2 border-t border-white/[0.05]">
              <p className="text-center text-[9px] xs:text-xs text-gray-600 uppercase tracking-wider">
                Or confirm manually
              </p>
              {/*
                Buttons are intentionally large (py-3.5 minimum = 44px+) to meet
                touch-target guidelines on wearable / small touch screens.
              */}
              <div className="grid grid-cols-2 gap-2 xs:gap-3">
                <button
                  onClick={() => handleManualConfirm('completed')}
                  className="py-3.5 xs:py-4 bg-green-500/10 hover:bg-green-500/20 active:bg-green-500/30 border border-green-500/30 rounded-xl xs:rounded-2xl text-green-400 font-bold text-sm xs:text-base transition-colors"
                >
                  ✓ Yes, Done
                </button>
                <button
                  onClick={() => handleManualConfirm('missed')}
                  className="py-3.5 xs:py-4 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 border border-red-500/30 rounded-xl xs:rounded-2xl text-red-400 font-bold text-sm xs:text-base transition-colors"
                >
                  ✗ Not Yet
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VoiceInteractionModal;
