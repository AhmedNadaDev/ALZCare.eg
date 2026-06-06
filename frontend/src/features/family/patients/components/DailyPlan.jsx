import React, { useState, useEffect, useCallback, useRef } from 'react';
import { dailyPlanAPI } from '../../../../modules/shared/api/api';
import { getSocket, joinPatientRoom } from '../../../../modules/shared/socket/socketClient';

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TrashIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const EditIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const CheckIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const WifiIcon = ({ connected }) => (
  <svg className={`h-3.5 w-3.5 ${connected ? 'text-green-400' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  wake_up:     'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
  medication:  'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  appointment: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
  custom:      'from-green-500/20 to-emerald-500/20 border-green-500/30',
};
const TYPE_TEXT_COLORS = {
  wake_up: 'text-amber-400', medication: 'text-blue-400', appointment: 'text-purple-400', custom: 'text-green-400'
};
const STATUS_COLORS = {
  pending:   'bg-gray-500/20 text-gray-400 border-gray-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  missed:    'bg-red-500/20 text-red-400 border-red-500/30',
};
const TYPE_LABELS  = { wake_up: 'Wake Up', medication: 'Medication', appointment: 'Appointment', custom: 'Custom' };
const TYPE_EMOJIS  = { wake_up: '🌅', medication: '💊', appointment: '🏥', custom: '📌' };
const DEFAULT_PROMPTS = {
  wake_up:     'Good morning! It\'s time to wake up. How are you feeling today?',
  medication:  'It\'s time to take your medication. Did you take it?',
  appointment: 'You have an appointment today. Are you ready?',
  custom:      'It\'s time for your scheduled activity. Are you ready?',
};
const todayStr = () => new Date().toISOString().split('T')[0];
const emptyForm = () => ({ title: '', type: 'medication', scheduledTime: '08:00', voicePromptText: '', requireResponse: true });

// ── Component ─────────────────────────────────────────────────────────────────
const DailyPlan = ({ patientId, patientName }) => {
  const [plan, setPlan]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [connected, setConnected]     = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm]               = useState(emptyForm());
  const [liveAlert, setLiveAlert]     = useState(null); // real-time notification toast
  const alertTimerRef                 = useRef(null);
  const mountedRef                    = useRef(true);

  // ── HTTP fetch ───────────────────────────────────────────────────────────────
  const fetchPlan = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const isToday = selectedDate === todayStr();
      const res = isToday
        ? await dailyPlanAPI.getToday(patientId)
        : await dailyPlanAPI.getByDate(patientId, selectedDate);
      if (mountedRef.current) setPlan(res.data || null);
    } catch (err) {
      if (err.status !== 404 && mountedRef.current) setError(err.message || 'Failed to load plan');
      if (mountedRef.current) setPlan(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [patientId, selectedDate]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // ── Socket real-time sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    mountedRef.current = true;

    const socket = getSocket();
    joinPatientRoom(patientId);

    const onConnect    = () => { if (mountedRef.current) setConnected(true); };
    const onDisconnect = () => { if (mountedRef.current) setConnected(false); };
    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);

    const handlePlanUpdate = ({ plan: updatedPlan } = {}) => {
      if (!mountedRef.current) return;
      // Only apply if it's for today (or matches selected date)
      if (updatedPlan) {
        const planDate = new Date(updatedPlan.date).toISOString().split('T')[0];
        if (planDate === selectedDate) {
          setPlan(updatedPlan);
          setLoading(false);
        }
      } else {
        fetchPlan();
      }
    };

    socket.on('dailyPlan:updated', handlePlanUpdate);
    socket.on('event:completed',   handlePlanUpdate);
    socket.on('event:missed',      handlePlanUpdate);

    // Real-time notification push from backend (missed medication alerts, etc.)
    const handleNotification = ({ notification } = {}) => {
      if (!mountedRef.current || !notification) return;
      setLiveAlert(notification);
      // Auto-dismiss after 8 seconds
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setLiveAlert(null);
      }, 8000);
    };
    socket.on('notification:new', handleNotification);

    return () => {
      mountedRef.current = false;
      clearTimeout(alertTimerRef.current);
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('dailyPlan:updated',handlePlanUpdate);
      socket.off('event:completed',  handlePlanUpdate);
      socket.off('event:missed',     handlePlanUpdate);
      socket.off('notification:new', handleNotification);
    };
  }, [patientId, selectedDate, fetchPlan]);

  // ── Add event ────────────────────────────────────────────────────────────────
  const handleAddEvent = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const event = {
        title:        form.title.trim() || TYPE_LABELS[form.type],
        type:         form.type,
        scheduledTime: form.scheduledTime,
        voicePrompt:  {
          text:            form.voicePromptText.trim() || DEFAULT_PROMPTS[form.type],
          requireResponse: form.requireResponse
        }
      };
      await dailyPlanAPI.addEvents({ patientId, date: selectedDate, events: [event] });
      setForm(emptyForm());
      setShowAddForm(false);
      // Socket will push update; also fetch to be safe
      await fetchPlan();
    } catch (err) {
      setError(err.message || 'Failed to add event');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete event ─────────────────────────────────────────────────────────────
  const handleDeleteEvent = async (eventId) => {
    if (!plan?._id) return;
    if (!window.confirm('Delete this event?')) return;
    try {
      await dailyPlanAPI.deleteEvent(plan._id, eventId);
      // Socket will push update; also fetch
      await fetchPlan();
    } catch (err) {
      setError(err.message || 'Failed to delete event');
    }
  };

  // ── Manual confirm ───────────────────────────────────────────────────────────
  const handleManualConfirm = async (eventId, status) => {
    if (!plan?._id) return;
    try {
      await dailyPlanAPI.manualConfirm(plan._id, eventId, status);
      await fetchPlan();
    } catch (err) {
      setError(err.message || 'Failed to update event');
    }
  };

  // ── Save edit ────────────────────────────────────────────────────────────────
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEvent || !plan?._id) return;
    setSaving(true);
    try {
      await dailyPlanAPI.updateEvent(plan._id, editingEvent.eventId, {
        title:         editingEvent.form.title,
        scheduledTime: editingEvent.form.scheduledTime,
        voicePrompt:   {
          text:            editingEvent.form.voicePromptText || DEFAULT_PROMPTS[editingEvent.form.type],
          requireResponse: editingEvent.form.requireResponse
        }
      });
      setEditingEvent(null);
      await fetchPlan();
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const sortedEvents = [...(plan?.events || [])].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime)
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">Daily Care Plan</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5">
              <WifiIcon connected={connected} />
              <span className={`text-xs font-medium ${connected ? 'text-green-400' : 'text-gray-600'}`}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            Schedule voice-guided activities for {patientName || 'patient'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
          />
          <button
            onClick={() => { setShowAddForm(v => !v); setForm(emptyForm()); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-medium text-sm transition-colors"
          >
            <PlusIcon /> Add Event
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {/* Live notification toast — appears when backend pushes notification:new */}
      {liveAlert && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/40 rounded-2xl animate-pulse-once">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-lg">
            🚨
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-red-300 font-semibold text-sm">{liveAlert.title}</p>
            <p className="text-red-400/80 text-xs mt-0.5 leading-relaxed">{liveAlert.message}</p>
          </div>
          <button
            onClick={() => setLiveAlert(null)}
            className="flex-shrink-0 text-red-500/60 hover:text-red-400 transition-colors"
            aria-label="Dismiss alert"
          >
            <XIcon />
          </button>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddEvent} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">New Event</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value, voicePromptText: '' }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{TYPE_EMOJIS[v]} {l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Time</label>
              <input
                type="time" value={form.scheduledTime} required
                onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Title (optional)</label>
            <input
              type="text" value={form.title} placeholder={TYPE_LABELS[form.type]}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Voice Prompt</label>
            <textarea
              value={form.voicePromptText} rows={2}
              placeholder={DEFAULT_PROMPTS[form.type]}
              onChange={e => setForm(f => ({ ...f, voicePromptText: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox" id="req" checked={form.requireResponse}
              onChange={e => setForm(f => ({ ...f, requireResponse: e.target.checked }))}
              className="h-4 w-4 rounded border-white/20 text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="req" className="text-sm text-gray-400">Require voice response from patient</label>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-white font-medium text-sm transition-colors">
              {saving ? 'Saving…' : 'Add Event'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-5 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-xl text-gray-400 font-medium text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-gray-400 text-lg font-medium">No events scheduled</p>
          <p className="text-gray-600 text-sm mt-1">Add events using the button above</p>
        </div>
      ) : (
        <div className="relative space-y-4">
          <div className="absolute left-[3.25rem] top-6 bottom-6 w-px bg-white/[0.06] hidden sm:block" />
          {sortedEvents.map(event => (
            <div key={event._id} className="relative">
              {editingEvent?.eventId === event._id ? (
                <form onSubmit={handleSaveEdit}
                  className="bg-white/[0.04] border border-purple-500/30 rounded-2xl p-5 space-y-3 ml-0 sm:ml-20">
                  <h4 className="text-white font-semibold text-sm">Edit Event</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Title</label>
                      <input type="text" value={editingEvent.form.title}
                        onChange={e => setEditingEvent(ev => ({ ...ev, form: { ...ev.form, title: e.target.value } }))}
                        className="w-full px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Time</label>
                      <input type="time" value={editingEvent.form.scheduledTime}
                        onChange={e => setEditingEvent(ev => ({ ...ev, form: { ...ev.form, scheduledTime: e.target.value } }))}
                        className="w-full px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Voice Prompt</label>
                    <textarea value={editingEvent.form.voicePromptText} rows={2}
                      onChange={e => setEditingEvent(ev => ({ ...ev, form: { ...ev.form, voicePromptText: e.target.value } }))}
                      className="w-full px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingEvent(null)}
                      className="px-4 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-gray-400 text-sm transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-4 sm:gap-6 items-start">
                  {/* Time */}
                  <div className="flex-shrink-0 w-16 text-right pt-3.5">
                    <span className="text-sm font-mono text-gray-400 font-semibold">{event.scheduledTime}</span>
                  </div>
                  {/* Dot */}
                  <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-6 mt-3.5">
                    <div className={`h-3 w-3 rounded-full border-2 ${
                      event.status === 'completed' ? 'bg-green-500 border-green-400' :
                      event.status === 'missed'    ? 'bg-red-500 border-red-400' :
                                                     'bg-gray-600 border-gray-500'
                    }`} />
                  </div>
                  {/* Card */}
                  <div className={`flex-1 bg-gradient-to-br ${TYPE_COLORS[event.type]} border rounded-2xl p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{TYPE_EMOJIS[event.type]}</span>
                          <h4 className={`font-semibold truncate ${TYPE_TEXT_COLORS[event.type]}`}>{event.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[event.status]}`}>
                            {event.status}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">{event.voicePrompt?.text}</p>
                        {event.response?.text && (
                          <div className="mt-2 px-3 py-2 bg-black/20 rounded-lg">
                            <p className="text-xs text-gray-500">Patient response:</p>
                            <p className="text-sm text-gray-300 italic">"{event.response.text}"</p>
                            {event.response.aiIntent && (
                              <p className="text-xs text-purple-400 mt-1">
                                AI: {event.response.aiIntent} ({Math.round((event.response.aiConfidence || 0) * 100)}% confidence)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {event.status === 'pending' && <>
                          <button onClick={() => handleManualConfirm(event._id, 'completed')} title="Mark completed"
                            className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                            <CheckIcon />
                          </button>
                          <button onClick={() => handleManualConfirm(event._id, 'missed')} title="Mark missed"
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                            <XIcon />
                          </button>
                        </>}
                        <button
                          onClick={() => setEditingEvent({
                            eventId: event._id,
                            form: {
                              title:           event.title,
                              type:            event.type,
                              scheduledTime:   event.scheduledTime,
                              voicePromptText: event.voicePrompt?.text || '',
                              requireResponse: event.voicePrompt?.requireResponse ?? true
                            }
                          })}
                          title="Edit"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleDeleteEvent(event._id)} title="Delete"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {sortedEvents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',     value: sortedEvents.length,                                   color: 'text-white'     },
            { label: 'Completed', value: sortedEvents.filter(e => e.status === 'completed').length, color: 'text-green-400' },
            { label: 'Missed',    value: sortedEvents.filter(e => e.status === 'missed').length,    color: 'text-red-400'   },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyPlan;
