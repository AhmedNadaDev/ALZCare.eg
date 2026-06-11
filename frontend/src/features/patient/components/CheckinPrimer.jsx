/**
 * CheckinPrimer.jsx
 *
 * One-time setup so that scheduled mood check-ins can run FULLY AUTOMATICALLY
 * (no taps) later on. Browser security requires:
 *   • microphone permission to be granted once via a user gesture (then it is
 *     persistent per origin, and getUserMedia resolves silently afterwards), and
 *   • a prior user gesture / page engagement to unlock speechSynthesis audio.
 *
 * This component:
 *   • renders NOTHING if mic permission is already granted (fully hands-free),
 *   • otherwise shows a single unobtrusive "Enable voice check-ins" button.
 *     One tap grants the mic and unlocks audio — after that every scheduled
 *     check-in opens, speaks, records, and uploads with zero interaction.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { speak } from '../utils/voiceUtils';

const MicIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const CheckinPrimer = () => {
  // 'checking' | 'granted' | 'need-grant' | 'denied' | 'insecure'
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus('insecure');
        return;
      }
      try {
        if (navigator.permissions?.query) {
          const st = await navigator.permissions.query({ name: 'microphone' });
          if (cancelled) return;
          setStatus(st.state === 'granted' ? 'granted' : st.state === 'denied' ? 'denied' : 'need-grant');
          st.onchange = () => {
            setStatus(st.state === 'granted' ? 'granted' : st.state === 'denied' ? 'denied' : 'need-grant');
          };
        } else {
          // Permissions API not available — assume a one-time grant is needed.
          setStatus('need-grant');
        }
      } catch {
        if (!cancelled) setStatus('need-grant');
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      // 1) Grant the microphone (persistent once allowed).
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());   // release immediately; we only needed the grant
      // 2) Unlock speechSynthesis within this user gesture so the intro can auto-play later.
      speak('Voice check-ins are now enabled.', { rate: 0.9 }).catch(() => {});
      setStatus('granted');
      console.log('[CheckinPrimer] microphone granted + audio unlocked');
    } catch (err) {
      console.warn('[CheckinPrimer] enable failed:', err?.name, err?.message);
      setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'need-grant');
    } finally {
      setBusy(false);
    }
  }, []);

  if (status === 'checking' || status === 'granted') return null;

  const denied = status === 'denied';
  const insecure = status === 'insecure';

  return (
    <div className="mb-5 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 flex-shrink-0">
        <MicIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          {insecure ? 'Microphone unavailable' : denied ? 'Microphone is blocked' : 'Enable automatic voice check-ins'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
          {insecure
            ? 'Open this app over https:// or http://localhost so the microphone can be used.'
            : denied
            ? 'Please allow the microphone for this site in your browser settings, then reload.'
            : 'Allow the microphone once so scheduled check-ins can run automatically — no tapping needed later.'}
        </p>
      </div>
      {!insecure && !denied && (
        <button
          onClick={enable}
          disabled={busy}
          className="flex-shrink-0 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
      )}
    </div>
  );
};

export default CheckinPrimer;
