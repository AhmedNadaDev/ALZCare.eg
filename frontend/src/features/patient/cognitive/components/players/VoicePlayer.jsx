import React, { useState, useRef, useEffect } from 'react';

/**
 * VoicePlayer — speak responses to gentle prompts. Reads each prompt aloud
 * (speechSynthesis) and captures the answer via the Web Speech API when
 * available, with a tap fallback so it always works.
 */
const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const VoicePlayer = ({ content, onFinish }) => {
  const prompts = content.prompts || [];
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const interactions = useRef([]);
  const recRef = useRef(null);

  const prompt = prompts[idx];

  // Read the prompt aloud when it changes.
  useEffect(() => {
    if (!prompt) return;
    try {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(prompt.text);
      u.rate = 0.92;
      window.speechSynthesis?.speak(u);
    } catch { /* ignore */ }
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
  }, [prompt]);

  const next = (answer) => {
    interactions.current.push({ kind: 'voice', prompt: prompt.text, answer: answer || '', correct: true });
    setTranscript('');
    if (idx + 1 >= prompts.length) onFinish(interactions.current);
    else setIdx(idx + 1);
  };

  const listen = () => {
    if (!SpeechRecognition) { next('(spoken)'); return; }
    const rec = new SpeechRecognition();
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      setTranscript(text);
      setListening(false);
      setTimeout(() => next(text), 800);
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => setListening(false);
    try { rec.start(); } catch { setListening(false); }
  };

  if (!prompt) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto text-center">
      <span className="text-sm text-emerald-300 mb-3">Prompt {idx + 1} of {prompts.length}</span>
      <div className="text-3xl mb-4">🎤</div>
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">{prompt.text}</h2>

      {transcript && <p className="text-emerald-300 text-lg mb-4">“{transcript}”</p>}

      <button
        onClick={listen}
        disabled={listening}
        className={`w-44 h-44 rounded-full text-white text-xl font-bold border-4 transition ${
          listening
            ? 'bg-red-500/30 border-red-400 animate-pulse'
            : 'bg-gradient-to-br from-emerald-600 to-green-500 border-emerald-300 hover:scale-105'
        }`}
      >
        {listening ? 'Listening…' : '🎙️ Speak'}
      </button>

      <button onClick={() => next('(answered aloud)')} className="mt-6 px-6 py-3 rounded-xl border border-white/15 text-gray-300 hover:text-white text-lg">
        I answered →
      </button>
    </div>
  );
};

export default VoicePlayer;
