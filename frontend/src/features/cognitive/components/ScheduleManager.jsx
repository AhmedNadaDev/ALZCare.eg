import React, { useState } from 'react';
import { cognitiveAPI } from '../../../modules/shared/api/api';
import {
  Field, inputCls, btnPrimary, EmptyState, EXERCISE_META,
  RECURRENCES, WEEKDAYS,
} from '../constants.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faClock } from '@fortawesome/free-solid-svg-icons';

const assignmentLabel = (a) => {
  if (!a) return 'Activity';
  if (a.kind === 'album') return `📚 ${a.album?.title || a.title || 'Album'}`;
  const meta = EXERCISE_META[a.exerciseType || a.exerciseTemplate?.type];
  return `${meta?.emoji || '🧠'} ${a.exerciseTemplate?.name || a.title || 'Exercise'}`;
};

const recurrenceLabel = (s) => {
  if (s.recurrence === 'daily') return 'Every day';
  if (s.recurrence === 'once') return `Once${s.date ? ` · ${new Date(s.date).toLocaleDateString()}` : ''}`;
  const days = (s.daysOfWeek || []).map((d) => WEEKDAYS.find((w) => w.key === d)?.short).filter(Boolean).join(', ');
  return days || 'Weekly';
};

/**
 * ScheduleManager — create/activate recurring cognitive sessions.
 */
const ScheduleManager = ({ patientId, schedules, assignments, refetchSchedules }) => {
  const enabledAssignments = assignments.filter((a) => a.enabled);
  const [form, setForm] = useState({ assignmentId: '', recurrence: 'daily', daysOfWeek: [], time: '18:00', date: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [runErr, setRunErr] = useState(null);

  const toggleDay = (key) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(key) ? f.daysOfWeek.filter((d) => d !== key) : [...f.daysOfWeek, key],
    }));

  const create = async (e) => {
    e.preventDefault();
    if (!form.assignmentId) { setErr('Choose an activity to schedule'); return; }
    if ((form.recurrence === 'weekly' || form.recurrence === 'custom') && form.daysOfWeek.length === 0) {
      setErr('Pick at least one day'); return;
    }
    setSaving(true); setErr(null);
    try {
      await cognitiveAPI.createSchedule(patientId, {
        assignmentId: form.assignmentId,
        recurrence: form.recurrence,
        daysOfWeek: form.daysOfWeek,
        time: form.time,
        date: form.recurrence === 'once' ? form.date || undefined : undefined,
      });
      setForm({ assignmentId: '', recurrence: 'daily', daysOfWeek: [], time: '18:00', date: '' });
      await refetchSchedules();
    } catch (e2) {
      setErr(e2.message || 'Failed to create schedule');
    } finally { setSaving(false); }
  };

  const run = async (key, fn) => {
    setBusy(key);
    setRunErr(null);
    try {
      await fn();
      await refetchSchedules();
    } catch (e) {
      setRunErr(e.message || 'Action failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Create form */}
      <form onSubmit={create} className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 h-fit">
        <h3 className="text-lg font-semibold text-white mb-4">New schedule</h3>
        {err && <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{err}</div>}
        {runErr && <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{runErr}</div>}
        <Field label="Activity">
          {enabledAssignments.length === 0 ? (
            <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              No enabled activities yet. Go to the Activities tab and enable at least one exercise or album first.
            </p>
          ) : (
            <select className={inputCls} value={form.assignmentId} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })}>
              <option value="" className="bg-[#150a2b]">Choose an activity…</option>
              {enabledAssignments.map((a) => <option key={a._id} value={a._id} className="bg-[#150a2b]">{assignmentLabel(a)}</option>)}
            </select>
          )}
        </Field>
        <Field label="Repeat">
          <select className={inputCls} value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
            {RECURRENCES.map((r) => <option key={r} value={r} className="bg-[#150a2b] capitalize">{r === 'once' ? 'One time' : r}</option>)}
          </select>
        </Field>
        {(form.recurrence === 'weekly' || form.recurrence === 'custom') && (
          <Field label="Days">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button type="button" key={d.key} onClick={() => toggleDay(d.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition ${form.daysOfWeek.includes(d.key) ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                  {d.short}
                </button>
              ))}
            </div>
          </Field>
        )}
        {form.recurrence === 'once' && (
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        )}
        <Field label="Time"><input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
        <button type="submit" className={btnPrimary + ' w-full'} disabled={saving}>{saving ? 'Saving…' : 'Add schedule'}</button>
      </form>

      {/* List */}
      <div className="lg:col-span-3">
        <h3 className="text-lg font-semibold text-white mb-4">Active schedules</h3>
        {schedules.length === 0 ? (
          <EmptyState icon="🗓️" title="No schedules yet" hint="Create a schedule to automatically deliver sessions to the patient." />
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s._id} className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${s.isActive ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01] opacity-60'}`}>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{assignmentLabel(s.assignment)}</p>
                  <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <FontAwesomeIcon icon={faClock} className="w-3.5 h-3.5" aria-hidden="true" /> {s.time} · {recurrenceLabel(s)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => run(`act-${s._id}`, () => cognitiveAPI.setScheduleActive(s._id, !s.isActive))}
                    disabled={busy === `act-${s._id}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${s.isActive ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                  >
                    {s.isActive ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => run(`del-${s._id}`, () => cognitiveAPI.deleteSchedule(s._id))} className="p-2 text-gray-400 hover:text-red-400" aria-label="Delete schedule" type="button">
                    <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleManager;
