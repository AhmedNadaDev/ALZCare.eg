import React, { useState, useEffect, useCallback } from 'react';
import { cognitiveAPI } from '../../../../modules/shared/api/api';
import { EXERCISE_META, Spinner } from '../../../cognitive/constants.jsx';
import { useCognitiveSessions } from '../hooks/useCognitiveSessions';
import SessionPlayer from './SessionPlayer';

const metaFor = (kind, exerciseType) =>
  kind === 'album'
    ? { emoji: '📚', label: 'Memory Album', gradient: 'from-purple-600 to-fuchsia-600' }
    : EXERCISE_META[exerciseType] || { emoji: '🧠', label: 'Activity', gradient: 'from-purple-600 to-violet-600' };

/**
 * CognitiveSessions — the patient's "Today" panel. Shows scheduled sessions
 * and available activities as large, touch-friendly cards and launches the
 * fullscreen SessionPlayer. Smartwatch-first: single column, big targets.
 */
const CognitiveSessions = ({ patientId }) => {
  const { due, activities, loading, refresh, autoStartId, clearAutoStart } = useCognitiveSessions(patientId);
  const [active, setActive] = useState(null); // { session, content, autoplay }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const startDue = useCallback(async (sessionId, autoplay = false) => {
    setBusy(sessionId); setErr(null);
    try {
      const res = await cognitiveAPI.startExisting(sessionId);
      setActive({ session: res.data.session, content: res.data.content, autoplay });
    } catch (e) {
      setErr(e.message || 'Could not start the session');
    } finally { setBusy(null); }
  }, []);

  const startActivity = useCallback(async (assignmentId) => {
    setBusy(assignmentId); setErr(null);
    try {
      const res = await cognitiveAPI.startSession(assignmentId);
      setActive({ session: res.data.session, content: res.data.content, autoplay: false });
    } catch (e) {
      setErr(e.message || 'Could not start the activity');
    } finally { setBusy(null); }
  }, []);

  // Auto-open a session the scheduler asked to auto-start.
  useEffect(() => {
    if (autoStartId && !active) {
      startDue(autoStartId, true);
      clearAutoStart();
    }
  }, [autoStartId, active, startDue, clearAutoStart]);

  const close = () => { setActive(null); refresh(); };

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner className="w-10 h-10" /></div>;
  }

  const hasContent = due.length > 0 || activities.length > 0;

  return (
    <section className="w-full">
      {err && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-center">{err}</div>}

      {!hasContent ? (
        <div className="text-center py-10 text-gray-300">
          <div className="text-5xl mb-3">🌼</div>
          <p className="text-xl">No activities right now.</p>
          <p className="text-gray-400 mt-1">Your family will add some soon.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {due.length > 0 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">⏰ For you now</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {due.map((s) => {
                  const m = metaFor(s.kind, s.exerciseType);
                  return (
                    <button
                      key={s._id}
                      onClick={() => startDue(s._id)}
                      disabled={busy === s._id}
                      className="text-left rounded-3xl p-5 border-2 border-purple-500/40 bg-gradient-to-br from-purple-600/20 to-violet-600/10 hover:from-purple-600/30 transition disabled:opacity-60"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br ${m.gradient} flex items-center justify-center text-3xl`}>{m.emoji}</div>
                        <div className="min-w-0">
                          <p className="text-xl font-bold text-white truncate">{s.title || m.label}</p>
                          <p className="text-purple-200 text-base">{busy === s._id ? 'Starting…' : 'Tap to start →'}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activities.length > 0 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">✨ Activities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((a) => {
                  const m = metaFor(a.kind, a.exerciseType || a.exerciseTemplate?.type);
                  const title = a.kind === 'album' ? a.album?.title || a.title : a.exerciseTemplate?.name || a.title;
                  return (
                    <button
                      key={a._id}
                      onClick={() => startActivity(a._id)}
                      disabled={busy === a._id}
                      className="text-left rounded-3xl p-5 border-2 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-purple-500/30 transition disabled:opacity-60"
                    >
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.gradient} flex items-center justify-center text-2xl mb-3`}>{m.emoji}</div>
                      <p className="text-lg font-bold text-white truncate">{title}</p>
                      <p className="text-gray-400 text-sm">{busy === a._id ? 'Starting…' : m.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {active && (
        <SessionPlayer
          session={active.session}
          content={active.content}
          autoplay={active.autoplay}
          onClose={close}
          onCompleted={refresh}
        />
      )}
    </section>
  );
};

export default CognitiveSessions;
