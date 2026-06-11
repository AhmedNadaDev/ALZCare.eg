/**
 * PatientMood.jsx — AI Voice Mood Monitoring (Family Dashboard)
 *
 * WavLM multi-task model: six clinical mood states + low/high arousal.
 *
 * Family can:
 *   • schedule up to 6 daily voice check-ins (each slot fires independently)
 *   • see the latest mood + arousal, a 30-day breakdown, and a live timeline
 *
 * Real-time: listens for the 'mood:updated' Socket.IO event to refresh without reload.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { aiMoodAPI } from '../../../../modules/shared/api/api';
import { getSocket, joinPatientRoom } from '../../../../modules/shared/socket/socketClient';
import { fmt12, LatestMoodCard, MoodStatsPanel, MoodTimeline } from '../../../shared/mood/MoodViews';

const MAX_SLOTS = 6;

// ── Icons ─────────────────────────────────────────────────────────────────────
const BrainIcon   = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/></svg>;
const ClockIcon   = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const RefreshIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const PlusIcon    = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon   = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const SaveIcon    = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;

// ── Multi-slot Schedule Panel (family-only) ───────────────────────────────────
const SchedulePanel = ({ patientId, schedule, onSaved }) => {
  const initTimes = () => {
    if (schedule?.scheduledTimes?.length) return [...schedule.scheduledTimes].sort();
    if (schedule?.scheduledTime) return [schedule.scheduledTime];
    return ['09:00'];
  };

  const [times, setTimes]   = useState(initTimes);
  const [active, setActive] = useState(schedule?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    setTimes(initTimes());
    setActive(schedule?.isActive ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const addSlot = () => {
    if (times.length >= MAX_SLOTS) return;
    const last = times[times.length - 1] || '09:00';
    const [h, m] = last.split(':').map(Number);
    setTimes((prev) => [...prev, `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`]);
  };
  const removeSlot = (idx) => { if (times.length > 1) setTimes((prev) => prev.filter((_, i) => i !== idx)); };
  const updateSlot = (idx, value) => setTimes((prev) => prev.map((t, i) => (i === idx ? value : t)));

  const handleSave = async () => {
    setError('');
    if (new Set(times).size !== times.length) {
      setError('Duplicate times detected. Each slot must be unique.');
      return;
    }
    setSaving(true);
    try {
      await aiMoodAPI.setSchedule({ patientId, scheduledTimes: [...times].sort(), isActive: active });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400"><ClockIcon /></div>
          <div>
            <h3 className="text-sm font-bold text-white">Daily Check-in Schedule</h3>
            <p className="text-xs text-gray-500">Up to {MAX_SLOTS} daily check-ins</p>
          </div>
        </div>
        <button type="button" onClick={() => setActive((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${active ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
          {active ? '✓ Active' : '✗ Paused'}
        </button>
      </div>

      <div className="space-y-2">
        {times.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
            <input type="time" value={t} onChange={(e) => updateSlot(idx, e.target.value)}
              className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm focus:border-purple-500 outline-none" />
            <span className="text-xs text-gray-500 w-20 text-center">{fmt12(t)}</span>
            <button type="button" onClick={() => removeSlot(idx)} disabled={times.length <= 1}
              className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Remove this slot">
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {times.length < MAX_SLOTS && (
        <button type="button" onClick={addSlot}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-purple-500/50 text-sm transition-colors">
          <PlusIcon /> Add Check-in Time
        </button>
      )}

      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SaveIcon />}
        {saved ? 'Saved!' : saving ? 'Saving…' : `Save ${times.length} Schedule${times.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const PatientMood = ({ patientId }) => {
  const [history, setHistory]     = useState([]);
  const [latestMood, setLatest]   = useState(null);
  const [moodStats, setMoodStats] = useState(null);
  const [moodSchedule, setSched]  = useState(null);
  const [loading, setLoading]     = useState(true);
  const [liveUpdate, setLive]     = useState(false);

  const fetchAll = useCallback(async () => {
    if (!patientId) return;
    try {
      const [histRes, latRes, statsRes, schedRes] = await Promise.all([
        aiMoodAPI.getHistory(patientId, { days: 30, limit: 30 }),
        aiMoodAPI.getLatest(patientId),
        aiMoodAPI.getStats(patientId, 30),
        aiMoodAPI.getSchedule(patientId),
      ]);
      setHistory(histRes.data || []);
      setLatest(latRes.data || null);
      setMoodStats(statsRes.data || null);
      setSched(schedRes.data || null);
    } catch (err) {
      console.error('[PatientMood] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time mood updates.
  useEffect(() => {
    if (!patientId) return;
    const socket = getSocket();
    joinPatientRoom(patientId);
    const onMoodUpdated = ({ mood } = {}) => {
      if (!mood) return;
      setLatest(mood);
      setHistory((prev) => [mood, ...prev.slice(0, 49)]);
      setLive(true);
      setTimeout(() => setLive(false), 3000);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400"><BrainIcon /></div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Mood Monitoring</h2>
            <p className="text-xs text-gray-500">Automated voice-based check-ins (mood + arousal)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liveUpdate && <span className="text-xs px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30 animate-pulse">Live update!</span>}
          <button onClick={fetchAll} className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors" title="Refresh"><RefreshIcon /></button>
        </div>
      </div>

      <SchedulePanel patientId={patientId} schedule={moodSchedule} onSaved={fetchAll} />
      <LatestMoodCard mood={latestMood} />
      <MoodStatsPanel stats={moodStats} />

      <div>
        <p className="text-sm font-bold text-white mb-3">Check-in Timeline</p>
        <MoodTimeline history={history} />
      </div>
    </div>
  );
};

export default PatientMood;
