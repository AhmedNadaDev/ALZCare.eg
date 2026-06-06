/**
 * MoodCheckinModal.jsx
 *
 * AI Voice Mood Check-in — patient side.
 *
 * Flow: SPEAKING → RECORDING → PROCESSING → DONE | ERROR
 *
 * Root-cause fixes applied (see INCIDENT REPORT):
 *
 *  RC-2: run() useEffect now has a top-level try/catch so any error in
 *        startRecording() (or speak()) shows the ERROR phase instead of
 *        leaving the component frozen in SPEAKING forever.
 *
 *  RC-3: recorder.start() is wrapped in try/catch — DOMException (e.g. from
 *        browser quirks) now surfaces as an ERROR phase message.
 *
 *  RC-5: recorder.requestData() is called just before stop() to force the
 *        browser to flush any buffered chunks into ondataavailable immediately,
 *        preventing a race where the final chunk is missed.
 *
 *  RC-3b: MediaRecorder MIME-type selection uses isTypeSupported() fallback
 *         chain so Firefox and Safari don't throw NotSupportedError.
 *
 *  Blob size guard: blobs smaller than MIN_BLOB_BYTES are rejected before
 *  being sent, giving the user a clear error message.
 *
 *  Full console tracing at every step so production failures can be pinpointed
 *  in browser DevTools without guessing.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { speak } from '../utils/voiceUtils';
import { aiMoodAPI } from '../../../modules/shared/api/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const PHASE = {
  SPEAKING:   'speaking',
  RECORDING:  'recording',
  PROCESSING: 'processing',
  DONE:       'done',
  ERROR:      'error',
};

const RECORD_SECONDS = 12;
const MIN_BLOB_BYTES = 512;

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
];

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        console.log(`[MoodCheckin] Selected recording MIME: ${mime}`);
        return mime;
      }
    } catch { /* ignore */ }
  }
  console.warn('[MoodCheckin] No preferred MIME supported — using browser default');
  return '';
};

// ── WAV conversion ─────────────────────────────────────────────────────────────
const blobToArrayBuffer = (blob) => {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader error reading blob'));
    reader.readAsArrayBuffer(blob);
  });
};

const encodePCMtoWAV = (pcmFloat32, sampleRate) => {
  const numSamples   = pcmFloat32.length;
  const numChannels  = 1;
  const bitsPerSample = 16;
  const blockAlign   = (numChannels * bitsPerSample) / 8;
  const byteRate     = sampleRate * blockAlign;
  const dataChunkSz  = numSamples * blockAlign;

  const buf  = new ArrayBuffer(44 + dataChunkSz);
  const view = new DataView(buf);

  const ws = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  ws(0, 'RIFF');
  view.setUint32( 4, 36 + dataChunkSz, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20,  1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  ws(36, 'data');
  view.setUint32(40, dataChunkSz, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
    view.setInt16(off, Math.round(s * 32767), true);
  }

  return new Blob([buf], { type: 'audio/wav' });
};

const convertBlobToWAV = async (blob) => {
  console.log(`[MoodCheckin] convertBlobToWAV: input ${blob.size}B type="${blob.type}"`);

  const arrayBuffer = await blobToArrayBuffer(blob);

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('AudioContext not supported in this browser.');

  const ctx = new AC();
  let audioBuffer;
  try {
    audioBuffer = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
  } finally {
    ctx.close().catch(() => {});
  }

  let pcm;
  if (audioBuffer.numberOfChannels === 1) {
    pcm = audioBuffer.getChannelData(0);
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    pcm = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) pcm[i] = (ch0[i] + ch1[i]) * 0.5;
  }

  const wav = encodePCMtoWAV(pcm, audioBuffer.sampleRate);
  console.log(
    `[MoodCheckin] convertBlobToWAV: output ${wav.size}B WAV ` +
    `@ ${audioBuffer.sampleRate}Hz  duration=${audioBuffer.duration.toFixed(2)}s`
  );
  return wav;
};

// ── Emotion display config ─────────────────────────────────────────────────────
const EMOTION_CFG = {
  neutral:  { emoji: '😐', label: 'Neutral',  ring: 'border-gray-400/50  bg-gray-400/10  text-gray-300'    },
  happy:    { emoji: '😊', label: 'Happy',    ring: 'border-green-500/50 bg-green-500/10 text-green-400'   },
  sad:      { emoji: '😢', label: 'Sad',      ring: 'border-blue-500/50  bg-blue-500/10  text-blue-400'    },
  angry:    { emoji: '😠', label: 'Angry',    ring: 'border-red-500/50   bg-red-500/10   text-red-400'     },
  fear:     { emoji: '😨', label: 'Fear',     ring: 'border-orange-500/50 bg-orange-500/10 text-orange-400'},
  disgust:  { emoji: '🤢', label: 'Disgust',  ring: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'},
  surprise: { emoji: '😲', label: 'Surprise', ring: 'border-purple-500/50 bg-purple-500/10 text-purple-400'},
  bored:    { emoji: '😑', label: 'Bored',    ring: 'border-slate-400/50  bg-slate-400/10  text-slate-300' },
};
const emotionCfg = (e) => EMOTION_CFG[e] || EMOTION_CFG.neutral;

// ── SVG Icons — responsive size via className prop ─────────────────────────────
const SpeakerIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);
const MicIcon = () => (
  <svg className="h-6 w-6 xs:h-9 xs:w-9 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

// ── Countdown progress bar ─────────────────────────────────────────────────────
const CountdownBar = ({ seconds, total }) => {
  const pct    = Math.max(0, (seconds / total) * 100);
  const urgent = seconds <= 3;
  return (
    <div className="w-full space-y-1 xs:space-y-1.5">
      <div className="flex justify-between px-0.5">
        <span className="text-[10px] xs:text-xs text-gray-500 uppercase tracking-wider">Recording</span>
        <span className={`text-sm xs:text-lg font-bold font-mono tabular-nums ${urgent ? 'text-red-400' : 'text-purple-300'}`}>
          {String(seconds).padStart(2, '0')}s
        </span>
      </div>
      <div className="h-2 xs:h-2.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${urgent ? 'bg-red-500' : 'bg-purple-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Waveform animation ─────────────────────────────────────────────────────────
// 8 bars on watch (< xs), all 12 bars on xs+
const Waveform = () => (
  <div className="flex justify-center items-end gap-[3px] xs:gap-[4px] h-8 xs:h-10">
    {[6, 10, 16, 24, 16, 10, 6, 14, 22, 14, 8, 18].map((h, i) => (
      <div
        key={i}
        className={`w-[4px] xs:w-[5px] bg-red-400/70 rounded-full animate-bounce ${i >= 8 ? 'hidden xs:block' : ''}`}
        style={{ height: `${h}px`, animationDelay: `${i * 0.08}s`, animationDuration: '0.7s' }}
      />
    ))}
  </div>
);

// ── Close (X) icon ─────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg className="h-4 w-4 xs:h-5 xs:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// MoodCheckinModal
//
// Responsive layout:
//   watch (< 480px) — minimal padding, smaller icons, 8 waveform bars
//   xs+  (≥ 480px) — standard spacing, full icons, 12 waveform bars
// ─────────────────────────────────────────────────────────────────────────────
const MoodCheckinModal = ({ checkin, patientId, onDone, onDismiss }) => {
  const [phase, setPhase]         = useState(PHASE.SPEAKING);
  const [countdown, setCountdown] = useState(RECORD_SECONDS);
  const [result, setResult]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  const mountedRef  = useRef(true);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const streamRef   = useRef(null);

  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      try {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      } catch { /* ignore */ }
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
    };
  }, []);

  // ── STEP 3: Submit audio blob ──────────────────────────────────────────────
  const submitAudio = useCallback(async (blob, mimeType) => {
    if (!mountedRef.current) {
      console.log('[MoodCheckin] submitAudio: unmounted — abort');
      return;
    }

    const blobType = blob.type || mimeType || 'audio/webm';
    console.log(`[MoodCheckin] STEP 3 — blob: size=${blob.size}B type="${blobType}"`);

    if (blob.size < MIN_BLOB_BYTES) {
      console.warn(`[MoodCheckin] STEP 3 — blob too small (${blob.size}B < ${MIN_BLOB_BYTES}B)`);
      setErrorMsg(`No audio captured (${blob.size} bytes). Please allow microphone access and speak clearly.`);
      setPhase(PHASE.ERROR);
      return;
    }

    setPhase(PHASE.PROCESSING);

    let uploadBlob = blob;
    try {
      uploadBlob = await convertBlobToWAV(blob);
      console.log(`[MoodCheckin] STEP 3a — WAV conversion OK: ${uploadBlob.size}B`);
    } catch (convErr) {
      console.warn(`[MoodCheckin] STEP 3a — WAV conversion failed (${convErr.message}), sending original blob`);
      uploadBlob = blob;
    }

    const formData = new FormData();
    formData.append('audio', uploadBlob, 'mood_checkin.wav');
    if (checkin?.scheduledTime) formData.append('scheduledTime', checkin.scheduledTime);

    console.log(`[MoodCheckin] STEP 3b — FormData ready: wav=${uploadBlob.size}B`);

    const t0 = Date.now();
    console.log('[MoodCheckin] STEP 3c — calling analyzeAudio…');

    try {
      const res = await aiMoodAPI.analyzeAudio(formData);
      const elapsed = Date.now() - t0;
      console.log(`[MoodCheckin] STEP 3d — response in ${elapsed}ms:`, JSON.stringify(res));

      if (!mountedRef.current) return;
      if (!res?.success) throw new Error(res?.message || 'Backend returned success=false');

      const moodData = res.data;
      console.log(`[MoodCheckin] STEP 3e — emotion="${moodData?.emotion}" conf=${moodData?.confidence}`);

      setResult(moodData);
      setPhase(PHASE.DONE);

      const label = emotionCfg(moodData?.emotion).label;
      speak(`Thank you. I detected that you are feeling ${label} today.`, { rate: 0.88 }).catch(() => {});
      onDone?.(moodData);

    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[MoodCheckin] STEP 3 ERROR:', err);
      setErrorMsg(err?.message || err?.detail || 'Could not analyse audio. Please try again.');
      setPhase(PHASE.ERROR);
    }
  }, [checkin, onDone]);

  // ── STEP 2: Start MediaRecorder ────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!mountedRef.current) return;
    console.log('[MoodCheckin] STEP 2 — requesting microphone…');

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Audio recording is not supported in this browser. Please use Chrome or Firefox.');
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      console.log(`[MoodCheckin] STEP 2a — mic granted, tracks: ${stream.getAudioTracks().length}`);
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone in your browser settings and try again.'
        : `Could not access microphone: ${err.message}`;
      throw new Error(msg);
    }

    const mimeType = pickMimeType();
    chunksRef.current = [];

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      console.log(`[MoodCheckin] STEP 2b — MediaRecorder created: mimeType="${recorder.mimeType}"`);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(`Could not initialise audio recorder: ${err.message}`);
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) {
        chunksRef.current.push(e.data);
        console.log(`[MoodCheckin] chunk: ${e.data.size}B (total: ${chunksRef.current.length} chunks)`);
      }
    };

    recorder.onerror = (e) => {
      console.error('[MoodCheckin] MediaRecorder error:', e.error);
    };

    recorder.onstop = () => {
      const totalChunks = chunksRef.current.length;
      console.log(`[MoodCheckin] STEP 2c — onstop: ${totalChunks} chunks`);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (!mountedRef.current) return;
      const finalMime = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: finalMime });
      console.log(`[MoodCheckin] STEP 2d — blob: ${blob.size}B type="${blob.type}"`);
      submitAudio(blob, finalMime);
    };

    try {
      recorder.start(250);
      console.log('[MoodCheckin] STEP 2e — recording started (250ms timeslice)');
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(`Recording could not start: ${err.message}`);
    }

    setPhase(PHASE.RECORDING);
    setCountdown(RECORD_SECONDS);

    let remaining = RECORD_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (mountedRef.current) setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        console.log('[MoodCheckin] STEP 2f — countdown zero, stopping recorder…');
        if (recorderRef.current?.state === 'recording') {
          try { recorderRef.current.requestData(); } catch { /* ignore */ }
          setTimeout(() => {
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
          }, 100);
        }
      }
    }, 1000);
  }, [submitAudio]);

  // ── STEP 1: Speak prompt → start recording ─────────────────────────────────
  useEffect(() => {
    const run = async () => {
      if (!mountedRef.current) return;

      const prompt = checkin?.prompt || 'Hello, I am the ALZCare system. How are you feeling today?';
      console.log('[MoodCheckin] STEP 1 — speaking prompt:', prompt);

      try {
        await speak(prompt, { rate: 0.85 });
      } catch (ttsErr) {
        console.warn('[MoodCheckin] STEP 1 — TTS threw (non-fatal):', ttsErr);
      }

      if (!mountedRef.current) {
        console.log('[MoodCheckin] STEP 1 — unmounted after TTS, aborting');
        return;
      }

      console.log('[MoodCheckin] STEP 1 — TTS done, starting recording…');

      try {
        await startRecording();
      } catch (recErr) {
        console.error('[MoodCheckin] STEP 2 ERROR caught by run():', recErr.message);
        if (mountedRef.current) {
          setErrorMsg(recErr.message || 'Could not start recording. Please check microphone permissions.');
          setPhase(PHASE.ERROR);
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = result?.emotion ? emotionCfg(result.emotion) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 xs:p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d0620] border border-white/10 rounded-2xl xs:rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-8px)] xs:max-h-[calc(100dvh-24px)] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center gap-2 xs:gap-3 px-3 xs:px-5 sm:px-6 py-2.5 xs:py-3.5 sm:py-4 bg-white/[0.03] border-b border-white/[0.06] sticky top-0 z-10">
          <span className="text-lg xs:text-2xl flex-shrink-0">🧠</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm xs:text-base sm:text-lg font-bold text-white leading-tight">Daily Mood Check-in</h2>
            <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5">
              {checkin?.scheduledTime ? `${checkin.scheduledTime} · ` : ''}ALZCare AI
            </p>
          </div>
          {/* Dismiss — generous tap target on watch */}
          <button
            onClick={onDismiss}
            className="p-2.5 xs:p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/[0.05] active:bg-white/[0.1] transition-colors flex-shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Dismiss check-in"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-3 xs:px-5 sm:px-6 pt-4 xs:pt-6 sm:pt-8 pb-4 xs:pb-5 sm:pb-6 space-y-3 xs:space-y-5 sm:space-y-6">

          {/* ── SPEAKING ── */}
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
                  {checkin?.prompt || 'How are you feeling today?'}
                </p>
                <p className="text-gray-600 text-[10px] xs:text-xs mt-2 xs:mt-3">
                  Recording starts automatically
                </p>
              </div>
            </div>
          )}

          {/* ── RECORDING ── */}
          {phase === PHASE.RECORDING && (
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
                <p className="text-gray-400 text-xs xs:text-sm mt-1">Please speak — tell me how you feel</p>
              </div>
              <Waveform />
              <CountdownBar seconds={countdown} total={RECORD_SECONDS} />
            </div>
          )}

          {/* ── PROCESSING ── */}
          {phase === PHASE.PROCESSING && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className="h-14 w-14 xs:h-20 xs:w-20 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
                  <div className="w-7 h-7 xs:w-9 xs:h-9 border-[3px] border-blue-500/25 border-t-blue-400 rounded-full animate-spin" />
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">Analysing…</p>
                <p className="text-gray-500 text-[10px] xs:text-xs mt-1.5 xs:mt-2 uppercase tracking-wider">AI is detecting your emotion</p>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === PHASE.DONE && cfg && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className={`h-14 w-14 xs:h-20 xs:w-20 rounded-full border-2 flex items-center justify-center text-3xl xs:text-4xl ${cfg.ring}`}>
                  {cfg.emoji}
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">Detected: {cfg.label}</p>
                {result?.confidence != null && (
                  <p className="text-gray-400 text-xs xs:text-sm mt-0.5 xs:mt-1">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </p>
                )}
                {isDev && (
                  <p className="text-gray-700 text-[10px] xs:text-xs mt-1.5 xs:mt-2 font-mono">
                    [dev] {result?.emotion} @ {Math.round((result?.confidence ?? 0) * 100)}%
                  </p>
                )}
                <p className="text-gray-500 text-[10px] xs:text-xs mt-2 xs:mt-3 leading-relaxed max-w-xs mx-auto">
                  Your response has been shared with your care team.
                </p>
              </div>
              {/* Big tap target for watch */}
              <button
                onClick={onDismiss}
                className="w-full py-3.5 xs:py-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl xs:rounded-2xl text-white font-semibold text-sm xs:text-base sm:text-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === PHASE.ERROR && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className="h-14 w-14 xs:h-20 xs:w-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-3xl xs:text-4xl">
                  ⚠️
                </div>
              </div>
              <div>
                <p className="text-white text-base xs:text-xl font-bold">Something went wrong</p>
                <p className="text-gray-400 text-xs xs:text-sm mt-1.5 xs:mt-2 max-w-xs mx-auto leading-relaxed">{errorMsg}</p>
              </div>
              <button
                onClick={onDismiss}
                className="w-full py-3.5 xs:py-4 bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-xl xs:rounded-2xl text-gray-300 font-semibold text-sm xs:text-base transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MoodCheckinModal;
