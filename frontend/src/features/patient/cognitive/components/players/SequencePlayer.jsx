import React, { useState, useEffect, useRef } from 'react';

/**
 * SequencePlayer — watch a sequence of lit tiles, then repeat it.
 * Two phases: WATCH (auto playback) then REPEAT (patient taps).
 */
const SequencePlayer = ({ content, onFinish }) => {
  const tiles = content.tiles || [];
  const sequence = content.sequence || [];
  const [phase, setPhase] = useState('watch'); // watch | repeat
  const [activeTile, setActiveTile] = useState(null);
  const [taps, setTaps] = useState([]);
  const [flash, setFlash] = useState(null); // tile id flashed on tap
  const timers = useRef([]);

  // Playback the sequence on mount / when phase becomes watch.
  useEffect(() => {
    if (phase !== 'watch') return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    sequence.forEach((tileId, i) => {
      timers.current.push(setTimeout(() => setActiveTile(tileId), i * 800 + 400));
      timers.current.push(setTimeout(() => setActiveTile(null), i * 800 + 900));
    });
    timers.current.push(setTimeout(() => setPhase('repeat'), sequence.length * 800 + 600));
    return () => timers.current.forEach(clearTimeout);
  }, [phase, sequence]);

  const tap = (tileId) => {
    if (phase !== 'repeat') return;
    setFlash(tileId);
    setTimeout(() => setFlash(null), 200);
    const next = [...taps, tileId];
    setTaps(next);
    if (next.length >= sequence.length) {
      setTimeout(() => onFinish([{ kind: 'answer', meta: { sequence: next } }]), 350);
    }
  };

  const cols = tiles.length <= 4 ? 2 : 3;

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">
        {phase === 'watch' ? '👀 Watch carefully' : '👆 Now repeat'}
      </h2>
      <p className="text-gray-300 mb-6 text-center">
        {phase === 'watch' ? 'Remember the order the lights flash.' : `Tap ${taps.length} / ${sequence.length}`}
      </p>

      <div className={`grid gap-3 w-full`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {tiles.map((t) => {
          const lit = (phase === 'watch' && activeTile === t.id) || (phase === 'repeat' && flash === t.id);
          return (
            <button
              key={t.id}
              onClick={() => tap(t.id)}
              disabled={phase !== 'repeat'}
              aria-label={t.id}
              className="aspect-square rounded-3xl border-4 border-white/10 transition-all duration-150"
              style={{
                backgroundColor: t.color,
                opacity: lit ? 1 : 0.35,
                transform: lit ? 'scale(1.04)' : 'scale(1)',
                boxShadow: lit ? `0 0 40px ${t.color}` : 'none',
              }}
            />
          );
        })}
      </div>

      {phase === 'repeat' && (
        <button
          onClick={() => { setTaps([]); setPhase('watch'); }}
          className="mt-6 px-5 py-2.5 rounded-xl border border-white/15 text-gray-300 hover:text-white"
        >
          ↻ Watch again
        </button>
      )}
    </div>
  );
};

export default SequencePlayer;
