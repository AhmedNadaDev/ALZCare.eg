import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mediaUrl, EMOTION_META } from '../../../cognitive/constants.jsx';

/**
 * AlbumViewer — calm, fullscreen memory viewing. One memory at a time with
 * large media, the person's name/relationship, the story, and voice playback.
 * Supports read-aloud and optional autoplay for scheduled memory sessions.
 */
const AlbumViewer = ({ content, autoplay = false, onFinish }) => {
  const items = content.items || [];
  const [idx, setIdx] = useState(0);
  const viewed = useRef(new Set());
  const interactions = useRef([]);
  const audioRef = useRef(null);
  const advanceTimer = useRef(null);

  const item = items[idx];

  // Record a view once per item.
  useEffect(() => {
    if (!item) return;
    if (!viewed.current.has(item._id)) {
      viewed.current.add(item._id);
      interactions.current.push({ kind: 'view', refId: item._id });
    }
  }, [item]);

  const readAloud = useCallback(() => {
    if (!item) return;
    try {
      window.speechSynthesis?.cancel();
      const parts = [item.name, item.relationship && `your ${item.relationship}`, item.story].filter(Boolean).join('. ');
      if (parts) {
        const u = new SpeechSynthesisUtterance(parts);
        u.rate = 0.9;
        window.speechSynthesis?.speak(u);
      }
    } catch { /* ignore */ }
  }, [item]);

  // Autoplay: narrate + auto-advance.
  useEffect(() => {
    if (!autoplay || !item) return;
    readAloud();
    advanceTimer.current = setTimeout(() => {
      if (idx + 1 < items.length) setIdx(idx + 1);
    }, 9000);
    return () => clearTimeout(advanceTimer.current);
  }, [autoplay, idx, item, items.length, readAloud]);

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  if (!item) {
    return (
      <div className="text-center text-white">
        <p className="text-xl">This album is empty.</p>
        <button onClick={() => onFinish([])} className="mt-5 px-6 py-3 rounded-xl bg-purple-600 text-white text-lg">Close</button>
      </div>
    );
  }

  const isLast = idx === items.length - 1;

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
      <div className="w-full text-center mb-3 text-purple-300">{idx + 1} of {items.length}</div>

      <div className="w-full max-w-xl aspect-square sm:aspect-video rounded-3xl overflow-hidden border-4 border-white/10 bg-black/40 flex items-center justify-center">
        {item.type === 'image' && item.mediaUrl ? (
          <img src={mediaUrl(item.mediaUrl)} alt={item.name || 'memory'} className="w-full h-full object-contain" />
        ) : item.type === 'video' && item.mediaUrl ? (
          <video src={mediaUrl(item.mediaUrl)} className="w-full h-full object-contain" controls autoPlay playsInline />
        ) : (
          <span className="text-7xl">{item.type === 'audio' ? '🎵' : '📝'}</span>
        )}
      </div>

      <div className="text-center mt-5 px-2">
        {item.name && <h2 className="text-3xl sm:text-4xl font-bold text-white">{item.name}</h2>}
        {item.relationship && <p className="text-xl text-purple-300 mt-1">{item.relationship} {EMOTION_META[item.emotion]?.emoji}</p>}
        {item.story && <p className="text-lg sm:text-xl text-gray-200 mt-3 leading-relaxed max-w-2xl">{item.story}</p>}
        {item.location && <p className="text-base text-gray-400 mt-2">📍 {item.location}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
        <button onClick={readAloud} className="px-5 py-3 rounded-xl border border-white/15 text-white text-lg hover:bg-white/10">🔊 Read aloud</button>
        {item.voiceNoteUrl && (
          <>
            <button onClick={() => audioRef.current?.play()} className="px-5 py-3 rounded-xl border border-white/15 text-white text-lg hover:bg-white/10">▶ Play voice</button>
            <audio ref={audioRef} src={mediaUrl(item.voiceNoteUrl)} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between w-full max-w-md mt-7 gap-3">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="px-6 py-4 rounded-2xl bg-white/8 border-2 border-white/15 text-white text-xl font-semibold disabled:opacity-30"
        >
          ← Back
        </button>
        {isLast ? (
          <button onClick={() => onFinish(interactions.current)} className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 text-white text-xl font-bold">
            Finish ✓
          </button>
        ) : (
          <button onClick={() => setIdx(idx + 1)} className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-xl font-bold">
            Next →
          </button>
        )}
      </div>
    </div>
  );
};

export default AlbumViewer;
