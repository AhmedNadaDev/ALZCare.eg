import React, { useState, useCallback } from 'react';
import { cognitiveAPI } from '../../../../modules/shared/api/api';
import { Spinner } from '../../../cognitive/constants.jsx';
import ChoicePlayer from './players/ChoicePlayer';
import SequencePlayer from './players/SequencePlayer';
import RoutinePlayer from './players/RoutinePlayer';
import VoicePlayer from './players/VoicePlayer';
import AlbumViewer from './AlbumViewer';

const encouragement = (score) => {
  if (score >= 85) return { emoji: '🌟', title: 'Wonderful!', msg: 'You did beautifully today.' };
  if (score >= 60) return { emoji: '😊', title: 'Great effort!', msg: 'You did really well.' };
  if (score >= 30) return { emoji: '💜', title: 'Nice try!', msg: 'Every bit of practice helps.' };
  return { emoji: '🤗', title: 'Thank you!', msg: 'We loved spending this time with you.' };
};

/**
 * SessionPlayer — fullscreen, distraction-free overlay that plays any cognitive
 * session by routing its content type to the matching renderer, then records
 * the result and shows a gentle, encouraging summary.
 */
const SessionPlayer = ({ session, content, autoplay = false, onClose, onCompleted }) => {
  const [phase, setPhase] = useState('play'); // play | completing | result
  const [result, setResult] = useState(null);

  const handleFinish = useCallback(
    async (interactions) => {
      setPhase('completing');
      try {
        const res = await cognitiveAPI.completeSession(session._id, interactions || []);
        setResult(res.data);
      } catch {
        setResult(null);
      } finally {
        setPhase('result');
        onCompleted?.();
      }
    },
    [session, onCompleted]
  );

  const renderPlayer = () => {
    if (content?.ready === false) {
      return (
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">🧩</div>
          <h2 className="text-2xl font-bold mb-2">Almost ready</h2>
          <p className="text-gray-300 text-lg">{content.reason || 'This activity needs a little more set-up.'}</p>
          <button onClick={onClose} className="mt-6 px-8 py-3 rounded-xl bg-purple-600 text-white text-lg font-semibold">OK</button>
        </div>
      );
    }
    switch (content?.type) {
      case 'face_recognition':
      case 'memory_recall':
        return <ChoicePlayer content={content} onFinish={handleFinish} />;
      case 'sequence_memory':
        return <SequencePlayer content={content} onFinish={handleFinish} />;
      case 'daily_routine':
        return <RoutinePlayer content={content} onFinish={handleFinish} />;
      case 'voice_recognition':
        return <VoicePlayer content={content} onFinish={handleFinish} />;
      case 'album':
        return <AlbumViewer content={content} autoplay={autoplay} onFinish={handleFinish} />;
      default:
        return (
          <div className="text-center text-white">
            <p className="text-xl">This activity could not be loaded.</p>
            <button onClick={onClose} className="mt-5 px-6 py-3 rounded-xl bg-purple-600 text-lg">Close</button>
          </div>
        );
    }
  };

  const enc = encouragement(result?.score ?? result?.completionRate ?? 0);

  return (
    <div className="fixed inset-0 z-[2000] bg-gradient-to-b from-[#0a0118] to-[#1a0b33] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <span className="text-purple-300 font-medium truncate text-sm sm:text-base">{session?.title || 'Activity'}</span>
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white text-base hover:bg-white/20" aria-label="Exit activity">
          ✕ Exit
        </button>
      </div>

      {/* Stage */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        {phase === 'completing' ? (
          <div className="flex flex-col items-center text-white"><Spinner className="w-12 h-12" /><p className="mt-4 text-lg">Saving…</p></div>
        ) : phase === 'result' ? (
          <div className="text-center text-white max-w-md">
            <div className="text-7xl mb-4">{enc.emoji}</div>
            <h2 className="text-3xl font-bold mb-2">{enc.title}</h2>
            <p className="text-gray-300 text-lg mb-6">{enc.msg}</p>
            {result && (
              <div className="inline-flex gap-6 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 mb-6">
                {typeof result.score === 'number' && (
                  <div><p className="text-3xl font-bold text-purple-300">{result.score}%</p><p className="text-xs text-gray-400">Score</p></div>
                )}
                <div><p className="text-3xl font-bold text-emerald-300">{result.completionRate ?? 0}%</p><p className="text-xs text-gray-400">Completed</p></div>
              </div>
            )}
            <div>
              <button onClick={onClose} className="px-10 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-xl font-bold">Done</button>
            </div>
          </div>
        ) : (
          renderPlayer()
        )}
      </div>
    </div>
  );
};

export default SessionPlayer;
