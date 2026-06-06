import React, { useState, useRef } from 'react';
import { mediaUrl } from '../../../../cognitive/constants.jsx';

/**
 * ChoicePlayer — renders multiple-choice rounds (face_recognition,
 * memory_recall). Large, high-contrast, one question at a time. Designed for
 * low cognitive load and big touch targets down to smartwatch widths.
 */
const ChoicePlayer = ({ content, onFinish }) => {
  const rounds = content.rounds || [];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong'
  const interactions = useRef([]);
  const startedAt = useRef(Date.now());

  const round = rounds[idx];
  if (!round) return null;

  const choose = (opt) => {
    if (picked) return;
    const correct = opt.id === round.answer;
    setPicked(opt.id);
    setFeedback(correct ? 'correct' : 'wrong');
    interactions.current.push({
      kind: 'answer',
      prompt: round.prompt,
      answer: opt.label,
      correct,
      responseMs: Date.now() - startedAt.current,
    });
    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        onFinish(interactions.current);
      } else {
        setIdx(idx + 1);
        setPicked(null);
        setFeedback(null);
        startedAt.current = Date.now();
      }
    }, 1100);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      <div className="w-full text-center mb-3">
        <span className="text-sm sm:text-base text-purple-300">Question {idx + 1} of {rounds.length}</span>
      </div>

      {round.media?.url && (
        <div className="w-full max-w-sm aspect-square rounded-3xl overflow-hidden border-4 border-white/10 mb-5 bg-black/30">
          {round.media.type === 'video' ? (
            <video src={mediaUrl(round.media.url)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
          ) : (
            <img src={mediaUrl(round.media.url)} alt="memory" className="w-full h-full object-cover" />
          )}
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">{round.prompt}</h2>
      {round.subtitle && <p className="text-base text-gray-300 text-center mb-5">{round.subtitle}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-2">
        {round.options.map((opt) => {
          const isPicked = picked === opt.id;
          const isAnswer = opt.id === round.answer;
          let cls = 'bg-white/8 border-white/15 hover:bg-white/15 text-white';
          if (picked) {
            if (isAnswer) cls = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
            else if (isPicked) cls = 'bg-red-500/25 border-red-400 text-red-100';
            else cls = 'bg-white/5 border-white/10 text-gray-400';
          }
          return (
            <button
              key={opt.id}
              onClick={() => choose(opt)}
              disabled={!!picked}
              className={`min-h-[64px] px-5 py-4 rounded-2xl border-2 text-xl sm:text-2xl font-semibold transition ${cls}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className={`mt-5 text-2xl font-bold ${feedback === 'correct' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {feedback === 'correct' ? '✓ Well done!' : '💜 Good try!'}
        </div>
      )}
    </div>
  );
};

export default ChoicePlayer;
