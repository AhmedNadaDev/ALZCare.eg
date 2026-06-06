/**
 * PatientMood.jsx — AI-Driven Emotion Monitoring (Family Dashboard)
 *
 * Multi-slot scheduling:
 *   Family can add up to 6 daily check-in times.
 *   Each time slot fires independently (scheduler uses composite key dedup).
 *
 * Real-time:
 *   Listens for 'mood:updated' Socket.IO event to refresh without reload.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { aiMoodAPI } from '../../../../modules/shared/api/api';
import { getSocket, joinPatientRoom } from '../../../../modules/shared/socket/socketClient';

// ── Emotion config ────────────────────────────────────────────────────────────
const EMOTION_CONFIG = {
  neutral:  { emoji: '😐', label: 'Neutral',  color: 'text-gray-300',  bg: 'bg-gray-500/20',    border: 'border-gray-500/30'   },
  happy:    { emoji: '😊', label: 'Happy',    color: 'text-green-400', bg: 'bg-green-500/20',   border: 'border-green-500/30'  },
  sad:      { emoji: '😢', label: 'Sad',      color: 'text-blue-400',  bg: 'bg-blue-500/20',    border: 'border-blue-500/30',  alert: true },
  angry:    { emoji: '😠', label: 'Angry',    color: 'text-red-400',   bg: 'bg-red-500/20',     border: 'border-red-500/30',   alert: true },
  fear:     { emoji: '😨', label: 'Fear',     color: 'text-orange-400',bg: 'bg-orange-500/20',  border: 'border-orange-500/30',alert: true },
  disgust:  { emoji: '🤢', label: 'Disgust',  color: 'text-yellow-400',bg: 'bg-yellow-500/20',  border: 'border-yellow-500/30',alert: true },
  surprise: { emoji: '😲', label: 'Surprise', color: 'text-purple-400',bg: 'bg-purple-500/20',  border: 'border-purple-500/30' },
  bored:    { emoji: '😑', label: 'Bored',    color: 'text-slate-400', bg: 'bg-slate-500/20',   border: 'border-slate-500/30'  },
};
const emotionCfg = (emotion) => EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

const MAX_SLOTS = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
};

const confBar = (conf) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.round(conf * 100)}%` }} />
    </div>
    <span className="text-xs text-gray-500 w-8 text-right">{Math.round(conf * 100)}%</span>
  </div>
);

const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const BrainIcon   = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/></svg>;
const ClockIcon   = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const RefreshIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const AlertIcon   = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const PlusIcon    = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon   = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const SaveIcon    = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;

// ── Multi-slot Schedule Panel ─────────────────────────────────────────────────
const SchedulePanel = ({ patientId, schedule, onSaved }) => {
  // Initialise from existing schedule (support both old single-time and new array format)
  const initTimes = () => {
    if (schedule?.scheduledTimes?.length) return [...schedule.scheduledTimes].sort();
    if (schedule?.scheduledTime) return [schedule.scheduledTime];  // legacy
    return ['09:00'];
  };

  const [times, setTimes]   = useState(initTimes);
  const [active, setActive] = useState(schedule?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  // Sync if schedule prop changes
  useEffect(() => {
    setTimes(initTimes());
    setActive(schedule?.isActive ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const addSlot = () => {
    if (times.length >= MAX_SLOTS) return;
    // Default new slot to one hour after the last slot
    const last = times[times.length - 1] || '09:00';
    const [h, m] = last.split(':').map(Number);
    const newH   = String((h + 1) % 24).padStart(2, '0');
    const newM   = String(m).padStart(2, '0');
    setTimes((prev) => [...prev, `${newH}:${newM}`]);
  };

  const removeSlot = (idx) => {
    if (times.length <= 1) return;  // keep at least one slot
    setTimes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx, value) => {
    setTimes((prev) => prev.map((t, i) => (i === idx ? value : t)));
  };

  const handleSave = async () => {
    setError('');
    // Validate: no duplicates
    const unique = [...new Set(times)];
    if (unique.length !== times.length) {
      setError('Duplicate times detected. Each slot must be unique.');
      return;
    }

    setSaving(true);
    try {
      await aiMoodAPI.setSchedule({
        patientId,
        scheduledTimes: times.sort(),
        isActive: active,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch (err) {
      setError('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
            <ClockIcon />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Daily Check-in Schedule</h3>
            <p className="text-xs text-gray-500">Up to {MAX_SLOTS} daily check-ins</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            active
              ? 'bg-green-500/20 border-green-500/30 text-green-400'
              : 'bg-red-500/20 border-red-500/30 text-red-400'
          }`}
        >
          {active ? '✓ Active' : '✗ Paused'}
        </button>
      </div>

      {/* Time slots */}
      <div className="space-y-2">
        {times.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
              {idx + 1}
            </div>
            <input
              type="time"
              value={t}
              onChange={(e) => updateSlot(idx, e.target.value)}
              className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm focus:border-purple-500 outline-none"
            />
            <span className="text-xs text-gray-500 w-20 text-center">{fmt12(t)}</span>
            <button
              type="button"
              onClick={() => removeSlot(idx)}
              disabled={times.length <= 1}
              className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Remove this slot"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {/* Add slot button */}
      {times.length < MAX_SLOTS && (
        <button
          type="button"
          onClick={addSlot}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-purple-500/50 text-sm transition-colors"
        >
          <PlusIcon />
          Add Check-in Time
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <SaveIcon />
        }
        {saved ? 'Saved!' : saving ? 'Saving…' : `Save ${times.length} Schedule${times.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
};

// ── Latest mood card ──────────────────────────────────────────────────────────
const LatestMoodCard = ({ mood }) => {
  if (!mood) {
    return (
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6 text-center">
        <div className="text-5xl mb-3">🧠</div>
        <p className="text-gray-300 font-medium">No check-in recorded yet</p>
        <p className="text-gray-500 text-sm mt-1">Set a schedule and the AI will check in automatically.</p>
      </div>
    );
  }
  const cfg = emotionCfg(mood.emotion);
  const { date, time } = fmt(mood.recordedAt);
  return (
    <div className={`rounded-2xl border p-6 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Latest AI Check-in</p>
        <p className="text-xs text-gray-500">{date} · {time}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-6xl">{cfg.emoji}</span>
        <div className="flex-1">
          <p className={`text-3xl font-bold ${cfg.color}`}>{cfg.label}</p>
          <p className="text-gray-400 text-sm mt-1">Confidence</p>
          {confBar(mood.confidence)}
        </div>
        {mood.isAbnormal && (
          <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-xs">
            <AlertIcon /> Alert
          </div>
        )}
      </div>
    </div>
  );
};

// ── Stats breakdown ───────────────────────────────────────────────────────────
const StatsPanel = ({ stats }) => {
  if (!stats?.breakdown?.length) return null;
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-5">
      <p className="text-sm font-bold text-white mb-4">
        Emotion Breakdown — Last {stats.days} Days ({stats.totalEntries} check-ins)
      </p>
      <div className="space-y-2">
        {stats.breakdown.map((item) => {
          const cfg = emotionCfg(item._id);
          const pct = stats.totalEntries > 0
            ? Math.round((item.count / stats.totalEntries) * 100) : 0;
          return (
            <div key={item._id} className="flex items-center gap-3">
              <span className="text-lg w-7 text-center">{cfg.emoji}</span>
              <span className="text-sm text-gray-300 w-20">{cfg.label}</span>
              <div className="flex-1 h-2 bg-white/[0.07] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-14 text-right">{item.count}× ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Timeline entry ────────────────────────────────────────────────────────────
const TimelineEntry = ({ mood }) => {
  const cfg = emotionCfg(mood.emotion);
  const { date, time } = fmt(mood.recordedAt);
  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${mood.isAbnormal ? 'bg-red-500/10 border-red-500/30' : 'bg-white/[0.02] border-white/[0.05]'}`}>
      <span className="text-2xl flex-shrink-0 mt-0.5">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {mood.isAbnormal && (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">Alert</span>
            )}
            <span className="text-xs text-gray-500">{date} {time}</span>
          </div>
        </div>
        <div className="mt-1.5">{confBar(mood.confidence)}</div>
        {mood.scheduledTime && (
          <p className="text-xs text-gray-600 mt-1">Slot: {fmt12(mood.scheduledTime)}</p>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const PatientMood = ({ patientId }) => {
  const [aiMoodHistory, setAiMoodHistory] = useState([]);
  const [latestMood, setLatestMood]       = useState(null);
  const [moodStats, setMoodStats]         = useState(null);
  const [moodSchedule, setMoodSchedule]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [liveUpdate, setLiveUpdate]       = useState(false);

  const fetchAll = useCallback(async () => {
    if (!patientId) return;
    try {
      const [histRes, latRes, statsRes, schedRes] = await Promise.all([
        aiMoodAPI.getHistory(patientId, { days: 30, limit: 30 }),
        aiMoodAPI.getLatest(patientId),
        aiMoodAPI.getStats(patientId, 30),
        aiMoodAPI.getSchedule(patientId),
      ]);
      setAiMoodHistory(histRes.data || []);
      setLatestMood(latRes.data || null);
      setMoodStats(statsRes.data || null);
      setMoodSchedule(schedRes.data || null);
    } catch (err) {
      console.error('[PatientMood] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time mood updates via Socket.IO
  useEffect(() => {
    if (!patientId) return;
    const socket = getSocket();
    joinPatientRoom(patientId);

    const onMoodUpdated = ({ mood } = {}) => {
      if (!mood) return;
      console.log('[PatientMood] mood:updated received:', mood.emotion);
      setLatestMood(mood);
      setAiMoodHistory((prev) => [mood, ...prev.slice(0, 49)]);
      setLiveUpdate(true);
      setTimeout(() => setLiveUpdate(false), 3000);
    };

    socket.on('mood:updated', onMoodUpdated);
    return () => socket.off('mood:updated', onMoodUpdated);
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
            <BrainIcon />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Emotion Monitoring</h2>
            <p className="text-xs text-gray-500">Automated voice-based check-ins</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liveUpdate && (
            <span className="text-xs px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30 animate-pulse">
              Live update!
            </span>
          )}
          <button
            onClick={fetchAll}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Multi-slot schedule panel */}
      <SchedulePanel
        patientId={patientId}
        schedule={moodSchedule}
        onSaved={fetchAll}
      />

      {/* Latest emotion */}
      <LatestMoodCard mood={latestMood} />

      {/* 30-day stats */}
      <StatsPanel stats={moodStats} />

      {/* Timeline */}
      <div>
        <p className="text-sm font-bold text-white mb-3">Check-in Timeline</p>
        {aiMoodHistory.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🎙️</div>
            <p className="text-gray-400">No AI check-ins recorded yet.</p>
            <p className="text-gray-500 text-sm mt-1">Set a schedule above — the system checks in automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {aiMoodHistory.map((mood) => (
              <TimelineEntry key={mood._id} mood={mood} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientMood;
