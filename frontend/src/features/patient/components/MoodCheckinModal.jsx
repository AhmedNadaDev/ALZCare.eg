/**
 * MoodCheckinModal.jsx
 *
 * AI Voice Mood Check-in — patient side. FULLY AUTOMATIC (no taps).
 *
 * Flow (zero patient interaction):
 *   modal opens (from scheduler socket event)
 *     → intro voice plays automatically
 *     → microphone recording starts automatically after the intro
 *     → patient speaks (live transcript shown on screen)
 *     → recording stops automatically after RECORD_SECONDS
 *     → audio converted to 16 kHz mono WAV and uploaded automatically
 *     → WavLM mood + arousal inference → saved → dashboards update
 *
 * Browser policy note:
 *   Automatic getUserMedia (no prompt, no gesture) only works once the patient
 *   has granted microphone permission ONCE for this origin. That one-time grant
 *   is primed earlier on the patient dashboard (see CheckinPrimer). speechSynthesis
 *   likewise needs prior page engagement, which the primer/login interaction
 *   satisfies. After the one-time grant, every check-in is hands-free.
 *
 * IMPORTANT: mood/arousal is inferred from the AUDIO by the WavLM model. The live
 * transcript (Web Speech API) is for patient visibility/UX ONLY and never feeds
 * the mood prediction.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { speak } from '../utils/voiceUtils';
import { aiMoodAPI } from '../../../modules/shared/api/api';
import { moodCfg, arousalCfg } from '../../shared/mood/moodConfig';

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
const TARGET_SR = 16000;        // WavLM model sample rate — produce a real 16 kHz WAV
const MIN_DURATION_S = 0.5;     // shorter than this is unusable
const SILENCE_RMS = 0.0015;     // below this the clip is effectively silent/muted

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
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch { /* ignore */ }
  }
  return '';
};

// ── WAV conversion (→ real 16 kHz mono 16-bit PCM) ──────────────────────────────
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
  const numSamples = pcmFloat32.length;
  const numChannels = 1, bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataChunkSz = numSamples * blockAlign;

  const buf = new ArrayBuffer(44 + dataChunkSz);
  const view = new DataView(buf);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  ws(0, 'RIFF');
  view.setUint32(4, 36 + dataChunkSz, true);
  ws(8, 'WAVE'); ws(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
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
  const arrayBuffer = await blobToArrayBuffer(blob);
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AC) throw new Error('AudioContext not supported in this browser.');

  const decodeCtx = new AC();
  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => decodeCtx.decodeAudioData(arrayBuffer, resolve, reject));
  } finally {
    decodeCtx.close().catch(() => {});
  }
  console.log(`[MoodCheckin] decoded ${decoded.sampleRate}Hz×${decoded.numberOfChannels}ch ${decoded.duration.toFixed(2)}s`);

  let pcm, outRate = TARGET_SR;
  if (OAC) {
    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_SR));
    const offline = new OAC(1, frames, TARGET_SR);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    pcm = rendered.getChannelData(0);
  } else {
    outRate = decoded.sampleRate;
    if (decoded.numberOfChannels === 1) {
      pcm = decoded.getChannelData(0);
    } else {
      const a = decoded.getChannelData(0), b = decoded.getChannelData(1);
      pcm = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) pcm[i] = (a[i] + b[i]) * 0.5;
    }
  }

  let peak = 0, sumSq = 0;
  for (let i = 0; i < pcm.length; i++) { const v = pcm[i], x = Math.abs(v); if (x > peak) peak = x; sumSq += v * v; }
  const rms = pcm.length ? Math.sqrt(sumSq / pcm.length) : 0;

  const wav = encodePCMtoWAV(pcm, outRate);
  const meta = { sampleRate: outRate, channels: 1, duration: pcm.length / outRate, peak: +peak.toFixed(4), rms: +rms.toFixed(5), bytes: wav.size };
  console.log('[MoodCheckin] WAV ready:', meta);
  return { blob: wav, meta };
};

const moodRing = (mood) => {
  const c = moodCfg(mood);
  return `${c.border} ${c.bg} ${c.color}`;
};

// ── Icons ───────────────────────────────────────────────────────────────────--
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
const CloseIcon = () => (
  <svg className="h-4 w-4 xs:h-5 xs:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── Countdown bar ───────────────────────────────────────────────────────────--
const CountdownBar = ({ seconds, total }) => {
  const pct = Math.max(0, (seconds / total) * 100);
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

// ── Live transcript panel (display-only; does NOT feed mood inference) ──────────
const TranscriptPanel = ({ finalText, interimText, listening }) => {
  const hasText = finalText || interimText;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 xs:p-4 text-left">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${listening ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-[10px] xs:text-xs uppercase tracking-wider text-gray-500">
          {listening ? 'Listening to you…' : 'What we heard'}
        </span>
      </div>
      <p className="text-sm xs:text-base leading-relaxed min-h-[2.5rem]">
        {hasText ? (
          <>
            <span className="text-white">{finalText}</span>
            {interimText && <span className="text-gray-400">{finalText ? ' ' : ''}{interimText}</span>}
          </>
        ) : (
          <span className="text-gray-600 italic">Your words will appear here as you speak…</span>
        )}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const MoodCheckinModal = ({ checkin, patientId, onDone, onDismiss }) => {
  const [phase, setPhase]         = useState(PHASE.SPEAKING);
  const [countdown, setCountdown] = useState(RECORD_SECONDS);
  const [result, setResult]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  // Live transcript (UX only)
  const [interimTx, setInterimTx] = useState('');
  const [finalTx, setFinalTx]     = useState('');
  const [listening, setListening] = useState(false);

  const mountedRef     = useRef(true);
  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const timerRef       = useRef(null);
  const streamRef      = useRef(null);
  const recognitionRef = useRef(null);
  const finalTxRef     = useRef('');

  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  // ── Live speech-to-text (Web Speech API) — display only ──────────────────────
  const stopSTT = useCallback(() => {
    setListening(false);
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { try { rec.onresult = rec.onend = rec.onerror = null; rec.stop(); } catch { /* ignore */ } }
  }, []);

  const startSTT = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn('[MoodCheckin] SpeechRecognition unavailable — transcript disabled'); return; }
    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (evt) => {
        let interim = '';
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          const r = evt.results[i];
          const txt = r[0]?.transcript || '';
          if (r.isFinal) {
            finalTxRef.current = `${finalTxRef.current} ${txt}`.trim();
          } else {
            interim += txt;
          }
        }
        if (!mountedRef.current) return;
        setFinalTx(finalTxRef.current);
        setInterimTx(interim);
      };
      rec.onerror = (e) => { console.warn('[MoodCheckin] STT error:', e.error); };
      rec.onend = () => {
        // Chrome auto-stops; if we're still recording, restart to keep it continuous.
        if (recognitionRef.current && recorderRef.current?.state === 'recording') {
          try { rec.start(); return; } catch { /* ignore */ }
        }
        if (mountedRef.current) setListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      console.log('[MoodCheckin] STT started (live transcript)');
    } catch (err) {
      console.warn('[MoodCheckin] STT start failed (non-fatal):', err);
    }
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────--
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      stopSTT();
      try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch { /* ignore */ }
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    };
  }, [stopSTT]);

  // ── Submit: convert → validate → upload (audio → WavLM) ──────────────────────
  const submitAudio = useCallback(async (blob, mimeType) => {
    if (!mountedRef.current) return;
    console.log(`[MoodCheckin] recorded blob: ${blob.size}B type="${blob.type || mimeType}"`);

    if (blob.size < MIN_BLOB_BYTES) {
      setErrorMsg('No audio was captured. Please make sure the microphone is enabled and try again.');
      setPhase(PHASE.ERROR);
      return;
    }

    setPhase(PHASE.PROCESSING);

    let uploadBlob, meta;
    try {
      const out = await convertBlobToWAV(blob);
      uploadBlob = out.blob; meta = out.meta;
    } catch (convErr) {
      console.error('[MoodCheckin] WAV conversion failed:', convErr);
      setErrorMsg('Could not process the recorded audio. Please try again.');
      setPhase(PHASE.ERROR);
      return;
    }

    if (meta.duration < MIN_DURATION_S) {
      setErrorMsg('The recording was too short. Please try again.');
      setPhase(PHASE.ERROR);
      return;
    }
    if (meta.peak < 0.01 || meta.rms < SILENCE_RMS) {
      setErrorMsg("We couldn't hear anything. Please check the microphone and try again.");
      setPhase(PHASE.ERROR);
      return;
    }

    const formData = new FormData();
    formData.append('audio', uploadBlob, 'mood_checkin.wav');
    if (checkin?.scheduledTime) formData.append('scheduledTime', checkin.scheduledTime);

    console.log(`[MoodCheckin] uploading ${meta.bytes}B WAV @ ${meta.sampleRate}Hz ${meta.duration.toFixed(2)}s`);
    try {
      const res = await aiMoodAPI.analyzeAudio(formData);
      if (!mountedRef.current) return;
      if (!res?.success) throw new Error(res?.message || 'Backend returned success=false');
      const moodData = res.data;
      console.log(`[MoodCheckin] mood="${moodData?.mood}" conf=${moodData?.moodConfidence} arousal="${moodData?.arousal}"`);
      setResult(moodData);
      setPhase(PHASE.DONE);
      speak('Thank you. Your response has been recorded.', { rate: 0.88 }).catch(() => {});
      onDone?.(moodData);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[MoodCheckin] upload/analyze error:', err);
      setErrorMsg(err?.message || 'Could not analyse audio. Please try again.');
      setPhase(PHASE.ERROR);
    }
  }, [checkin, onDone]);

  // ── Start microphone recording (automatic) ───────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!mountedRef.current) return;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone needs a secure connection (https or localhost).');
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Audio recording is not supported in this browser.');
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;
      console.log('[MoodCheckin] mic granted; tracks:', stream.getAudioTracks().length);
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access is blocked. Please allow the microphone for automatic check-ins.'
        : err.name === 'NotFoundError'
        ? 'No microphone was found on this device.'
        : `Could not access microphone: ${err.message}`;
      throw new Error(msg);
    }

    const mimeType = pickMimeType();
    chunksRef.current = [];

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(`Could not initialise audio recorder: ${err.message}`);
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onerror = (e) => console.error('[MoodCheckin] MediaRecorder error:', e.error);
    recorder.onstop = () => {
      stopSTT();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (!mountedRef.current) return;
      const finalMime = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: finalMime });
      console.log(`[MoodCheckin] onstop: ${chunksRef.current.length} chunks → ${blob.size}B`);
      submitAudio(blob, finalMime);
    };

    try {
      recorder.start(250);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(`Recording could not start: ${err.message}`);
    }

    // Live transcript runs in parallel with the recorder (display only).
    startSTT();

    setPhase(PHASE.RECORDING);
    setCountdown(RECORD_SECONDS);
    let remaining = RECORD_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (mountedRef.current) setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        if (recorderRef.current?.state === 'recording') {
          try { recorderRef.current.requestData(); } catch { /* ignore */ }
          setTimeout(() => {
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
          }, 100);
        }
      }
    }, 1000);
  }, [submitAudio, startSTT, stopSTT]);

  // ── AUTO-RUN: speak the prompt then start recording (no user interaction) ─────
  const beginCheckin = useCallback(async () => {
    if (!mountedRef.current) return;
    setPhase(PHASE.SPEAKING);
    const prompt = checkin?.prompt || 'Hello, I am the ALZCare system. How are you feeling today?';
    console.log('[MoodCheckin] speaking prompt:', prompt);
    try {
      await speak(prompt, { rate: 0.85 });
    } catch (ttsErr) {
      console.warn('[MoodCheckin] TTS threw (non-fatal):', ttsErr);
    }
    if (!mountedRef.current) return;
    try {
      await startRecording();
    } catch (recErr) {
      console.error('[MoodCheckin] startRecording failed:', recErr.message);
      if (mountedRef.current) {
        setErrorMsg(recErr.message || 'Could not start recording.');
        setPhase(PHASE.ERROR);
      }
    }
  }, [checkin, startRecording]);

  // Fire the whole flow automatically as soon as the modal mounts.
  useEffect(() => {
    beginCheckin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = result?.mood ? moodCfg(result.mood) : null;
  const arCfg = result?.arousal ? arousalCfg(result.arousal) : null;
  const transcriptText = finalTx || interimTx;

  // ── Render ───────────────────────────────────────────────────────────────--
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 xs:p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d0620] border border-white/10 rounded-2xl xs:rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-8px)] xs:max-h-[calc(100dvh-24px)] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-2 xs:gap-3 px-3 xs:px-5 sm:px-6 py-2.5 xs:py-3.5 sm:py-4 bg-white/[0.03] border-b border-white/[0.06] sticky top-0 z-10">
          <span className="text-lg xs:text-2xl flex-shrink-0">🧠</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm xs:text-base sm:text-lg font-bold text-white leading-tight">Daily Mood Check-in</h2>
            <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5">
              {checkin?.scheduledTime ? `${checkin.scheduledTime} · ` : ''}ALZCare AI
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-2.5 xs:p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/[0.05] active:bg-white/[0.1] transition-colors flex-shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Dismiss check-in"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="px-3 xs:px-5 sm:px-6 pt-4 xs:pt-6 sm:pt-8 pb-4 xs:pb-5 sm:pb-6 space-y-3 xs:space-y-5 sm:space-y-6">

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
                  {checkin?.prompt || 'How are you feeling today?'}
                </p>
                <p className="text-gray-600 text-[10px] xs:text-xs mt-2 xs:mt-3">Recording starts automatically</p>
              </div>
            </div>
          )}

          {/* RECORDING */}
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
                <p className="text-gray-400 text-xs xs:text-sm mt-1">Please tell me how you feel</p>
              </div>
              <TranscriptPanel finalText={finalTx} interimText={interimTx} listening={listening} />
              <CountdownBar seconds={countdown} total={RECORD_SECONDS} />
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
                <p className="text-white text-lg xs:text-2xl font-bold">Analysing…</p>
                <p className="text-gray-500 text-[10px] xs:text-xs mt-1.5 xs:mt-2 uppercase tracking-wider">Understanding how you feel</p>
              </div>
              {transcriptText && <TranscriptPanel finalText={finalTx} interimText={interimTx} listening={false} />}
            </div>
          )}

          {/* DONE */}
          {phase === PHASE.DONE && cfg && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className={`h-14 w-14 xs:h-20 xs:w-20 rounded-full border-2 flex items-center justify-center text-3xl xs:text-4xl ${moodRing(result.mood)}`}>
                  {cfg.emoji}
                </div>
              </div>
              <div>
                <p className="text-white text-lg xs:text-2xl font-bold">Thank you!</p>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  {arCfg && (
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${arCfg.bg} ${arCfg.border} ${arCfg.color}`}>
                      {arCfg.emoji} {arCfg.label}
                    </span>
                  )}
                </div>
                {result?.moodConfidence != null && (
                  <p className="text-gray-400 text-xs xs:text-sm mt-2">Confidence: {Math.round(result.moodConfidence * 100)}%</p>
                )}
                {isDev && (
                  <p className="text-gray-700 text-[10px] xs:text-xs mt-1.5 xs:mt-2 font-mono">
                    [dev] {result?.mood} @ {Math.round((result?.moodConfidence ?? 0) * 100)}% · arousal {result?.arousal}
                  </p>
                )}
              </div>
              {transcriptText && (
                <div className="text-left">
                  <p className="text-[10px] xs:text-xs uppercase tracking-wider text-gray-500 mb-1">You said</p>
                  <p className="text-sm text-gray-300 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 leading-relaxed">
                    “{transcriptText}”
                  </p>
                </div>
              )}
              <p className="text-gray-500 text-[10px] xs:text-xs leading-relaxed max-w-xs mx-auto">
                Your response has been shared with your care team.
              </p>
              <button
                onClick={onDismiss}
                className="w-full py-3.5 xs:py-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl xs:rounded-2xl text-white font-semibold text-sm xs:text-base sm:text-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ERROR */}
          {phase === PHASE.ERROR && (
            <div className="space-y-3 xs:space-y-5 text-center py-1 xs:py-2">
              <div className="flex justify-center">
                <div className="h-14 w-14 xs:h-20 xs:w-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-3xl xs:text-4xl">⚠️</div>
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
