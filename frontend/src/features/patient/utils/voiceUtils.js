/**
 * voiceUtils.js
 *
 * Utilities for the Voice Daily Care system.
 *
 *  buildVoiceMessage(event, patientName) → full spoken string
 *  speak(text, opts)                    → Promise (resolves after TTS finishes)
 *  startListening(onResult, onError)    → SpeechRecognition instance or null
 */

// ── Greeting ──────────────────────────────────────────────────────────────────
const getTimeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const buildVoiceMessage = (event, patientName) => {
  const name     = patientName ? `, ${patientName}` : '';
  const greeting = `Hello${name}. I am ALZCare. ${getTimeGreeting()}.`;
  const body     = event?.voicePrompt?.text || `It is time for: ${event?.title || 'your scheduled activity'}.`;
  return `${greeting} ${body}`;
};

// ── Text-to-Speech ────────────────────────────────────────────────────────────

const getVoices = () =>
  new Promise((resolve) => {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => resolve(window.speechSynthesis?.getVoices() || []), 2000);
  });

export const speak = async (text, { rate = 0.88, pitch = 1.0, volume = 1.0 } = {}) => {
  if (!window.speechSynthesis || !text) return;

  window.speechSynthesis.cancel();
  await new Promise(r => setTimeout(r, 120));

  const voices    = await getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate   = rate;
  utterance.pitch  = pitch;
  utterance.volume = volume;
  utterance.lang   = 'en-US';

  const preferred = voices.find(v =>
    v.lang.startsWith('en') &&
    /samantha|google us english|google uk english|karen|moira|natural/i.test(v.name)
  ) || voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  return new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearInterval(resumeInterval);
      clearTimeout(guard);
      resolve();
    };

    /*
     * Chrome backgrounding bug workaround:
     * When a Chrome tab loses focus, speechSynthesis silently pauses and
     * onend never fires. Calling resume() every 500 ms re-triggers synthesis
     * and eventually causes onend to fire.
     * References: https://bugs.chromium.org/p/chromium/issues/detail?id=679437
     */
    const resumeInterval = setInterval(() => {
      if (resolved) { clearInterval(resumeInterval); return; }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 500);

    // Hard cap: (chars / 10) * 1000ms + 3s safety margin
    // At rate=0.85, average English speech ≈ 10 chars/s
    const maxMs = Math.max(4000, (text.length / 10) * 1000 + 3000);
    const guard = setTimeout(() => {
      console.warn(`[TTS] guard fired after ${maxMs}ms — proceeding without onend`);
      done();
    }, maxMs);

    utterance.onend   = () => { console.log('[TTS] onend'); done(); };
    utterance.onerror = (e) => {
      console.warn('[TTS] onerror:', e.error);
      // 'interrupted' = cancel() was called by someone else; 'canceled' = same.
      // Either way, speech is done — proceed.
      done();
    };

    window.speechSynthesis.speak(utterance);
    console.log(`[TTS] speak() called: "${text.substring(0, 50)}…" (max ${maxMs}ms)`);
  });
};

// ── Speech-to-Text ────────────────────────────────────────────────────────────

/**
 * Start a single listening window.
 *
 * FIX — key design decisions:
 *  1. Wait for `isFinal === true` before calling onResult. Chrome fires onresult
 *     multiple times: first with interim results (isFinal=false, confidence=0),
 *     then with the final result (isFinal=true). Previously we grabbed the first
 *     interim result and called finish(), blocking the real final result.
 *  2. Empty / whitespace transcripts: call finish() + onError so onend doesn't
 *     double-fire onError('timeout').
 *  3. Single `resolved` flag prevents any double-callbacks.
 *
 * @param {Function} onResult  (transcript: string) => void
 * @param {Function} onError   (msg: string) => void
 * @param {number}   timeoutMs Hard cut-off (default 11 s matches STT_WINDOW_MS)
 */
export const startListening = (onResult, onError, timeoutMs = 11000) => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('[STT] SpeechRecognition not available');
    onError('Speech recognition is not supported. Please use Chrome or Edge.');
    return null;
  }

  const recognition           = new SR();
  recognition.lang            = 'en-US';
  recognition.interimResults  = true;   // FIX: must be true so we can detect isFinal
  recognition.maxAlternatives = 3;
  recognition.continuous      = false;

  let resolved  = false;
  let timeoutId = null;

  const finish = (label) => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeoutId);
    console.log(`[STT] finish() called from: ${label}`);
  };

  // Hard timeout — fires if neither onresult(final) nor onerror fires
  timeoutId = setTimeout(() => {
    if (resolved) return;
    console.log('[STT] hard timeout — stopping recognition');
    try { recognition.stop(); } catch { /* ignore */ }
    finish('timeout');
    onError('timeout');
  }, timeoutMs);

  recognition.onstart = () => {
    console.log('[STT] listening started');
  };

  recognition.onresult = (evt) => {
    if (resolved) return;

    const results = evt.results;
    if (!results || results.length === 0) {
      // No results object at all — ignore, wait for more
      console.log('[STT] onresult: empty results list, waiting…');
      return;
    }

    // Scan ALL result entries for a final result
    let bestTranscript = '';
    let bestConfidence = -1;
    let hasFinal = false;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.isFinal) continue;   // skip interim entries

      hasFinal = true;
      for (let j = 0; j < result.length; j++) {
        const alt = result[j];
        if (alt.confidence > bestConfidence) {
          bestConfidence = alt.confidence;
          bestTranscript = alt.transcript.trim();
        }
      }
    }

    if (!hasFinal) {
      // Only interim results so far — log and wait for the real final
      const interim = results[results.length - 1]?.[0]?.transcript?.trim() || '';
      console.log(`[STT] interim: "${interim}" — waiting for final…`);
      return;
    }

    console.log(`[STT] FINAL result: "${bestTranscript}" (confidence: ${bestConfidence.toFixed(2)})`);

    if (!bestTranscript) {
      // Final result arrived but transcript is empty — treat as no-speech
      console.warn('[STT] final transcript is empty — treating as no-speech');
      finish('empty-final');
      onError('no-speech');
      return;
    }

    finish('final-result');
    onResult(bestTranscript);
  };

  recognition.onerror = (evt) => {
    if (resolved) return;
    const msg = evt.error;
    console.error('[STT] error event:', msg);
    finish(`onerror:${msg}`);

    if (msg === 'aborted')       { return; }                          // intentional stop
    if (msg === 'no-speech')     { onError('timeout'); return; }      // treat same as timeout
    if (msg === 'audio-capture') { onError('Microphone not found. Please check your microphone.'); return; }
    if (msg === 'not-allowed')   { onError('Microphone permission denied. Please allow microphone access.'); return; }
    if (msg === 'network')       { onError('Network error during speech recognition.'); return; }
    onError(`Speech recognition error: ${msg}`);
  };

  recognition.onend = () => {
    console.log(`[STT] recognition.onend (resolved=${resolved})`);
    clearTimeout(timeoutId);
    // If finish() was NOT called by onresult or onerror, treat as timeout
    if (!resolved) {
      resolved = true;
      onError('timeout');
    }
  };

  try {
    recognition.start();
    console.log('[STT] recognition.start() called');
  } catch (err) {
    finish('start-threw');
    console.error('[STT] start() threw:', err);
    onError(`Could not start microphone: ${err.message}`);
  }

  return recognition;
};
