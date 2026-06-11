/**
 * MoodViews.jsx — shared presentational components for AI mood + arousal data.
 *
 * Used by both the family dashboard (with schedule editing + real-time updates)
 * and the doctor dashboard (read-only). Keeps the rendering logic in one place so
 * there is no duplicated mood UI across roles.
 */

import React from 'react';
import { moodCfg, arousalCfg } from './moodConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────
export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
};

export const fmt12 = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const ConfBar = ({ conf, color = 'bg-purple-500' }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round((conf || 0) * 100)}%` }} />
    </div>
    <span className="text-xs text-gray-500 w-8 text-right">{Math.round((conf || 0) * 100)}%</span>
  </div>
);

const AlertIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ── Arousal pill (the primary clinical signal) ─────────────────────────────────
export const ArousalPill = ({ arousal, confidence }) => {
  const a = arousalCfg(arousal);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${a.bg} ${a.border} ${a.color}`}>
      <span>{a.emoji}</span>
      {a.label}
      {confidence != null && <span className="text-gray-400 font-normal">· {Math.round(confidence * 100)}%</span>}
    </span>
  );
};

// ── Latest mood card ──────────────────────────────────────────────────────────
export const LatestMoodCard = ({ mood }) => {
  if (!mood) {
    return (
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6 text-center">
        <div className="text-5xl mb-3">🧠</div>
        <p className="text-gray-300 font-medium">No check-in recorded yet</p>
        <p className="text-gray-500 text-sm mt-1">The AI will check in at the scheduled times.</p>
      </div>
    );
  }
  const cfg = moodCfg(mood.mood);
  const { date, time } = fmtDateTime(mood.recordedAt);
  return (
    <div className={`rounded-2xl border p-6 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Latest AI Check-in</p>
        <p className="text-xs text-gray-500">{date} · {time}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-6xl">{cfg.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-3xl font-bold ${cfg.color}`}>{cfg.label}</p>
            <ArousalPill arousal={mood.arousal} confidence={mood.arousalConfidence} />
          </div>
          <p className="text-gray-400 text-sm mt-2">Mood confidence</p>
          <ConfBar conf={mood.moodConfidence} />
        </div>
        {mood.isAbnormal && (
          <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-xs">
            <AlertIcon /> Alert
          </div>
        )}
      </div>
      {mood.abstained && (
        <p className="text-xs text-amber-400/80 mt-3">Low confidence — flagged for human review.</p>
      )}
    </div>
  );
};

// ── Stats breakdown (mood frequency + arousal split) ───────────────────────────
export const MoodStatsPanel = ({ stats }) => {
  if (!stats?.breakdown?.length) return null;
  const arousal = stats.arousalBreakdown || [];
  const arousalTotal = arousal.reduce((s, x) => s + x.count, 0);
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-5 space-y-5">
      <div>
        <p className="text-sm font-bold text-white mb-4">
          Mood Breakdown — Last {stats.days} Days ({stats.totalEntries} check-ins)
        </p>
        <div className="space-y-2">
          {stats.breakdown.map((item) => {
            const cfg = moodCfg(item._id);
            const pct = stats.totalEntries > 0 ? Math.round((item.count / stats.totalEntries) * 100) : 0;
            return (
              <div key={item._id} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{cfg.emoji}</span>
                <span className="text-sm text-gray-300 w-20">{cfg.label}</span>
                <div className="flex-1 h-2 bg-white/[0.07] rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{item.count}× ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {arousalTotal > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Arousal (primary signal)</p>
          <div className="flex gap-2">
            {arousal.map((a) => {
              const ac = arousalCfg(a._id);
              const pct = Math.round((a.count / arousalTotal) * 100);
              return (
                <div key={a._id} className={`flex-1 rounded-xl border p-3 ${ac.bg} ${ac.border}`}>
                  <p className={`text-sm font-bold ${ac.color}`}>{ac.emoji} {ac.short}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.count}× · {pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Timeline ──────────────────────────────────────────────────────────────────
export const MoodTimelineEntry = ({ mood }) => {
  const cfg = moodCfg(mood.mood);
  const { date, time } = fmtDateTime(mood.recordedAt);
  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${mood.isAbnormal ? 'bg-red-500/10 border-red-500/30' : 'bg-white/[0.02] border-white/[0.05]'}`}>
      <span className="text-2xl flex-shrink-0 mt-0.5">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
            <ArousalPill arousal={mood.arousal} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {mood.isAbnormal && (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">Alert</span>
            )}
            <span className="text-xs text-gray-500">{date} {time}</span>
          </div>
        </div>
        <div className="mt-1.5"><ConfBar conf={mood.moodConfidence} /></div>
        {mood.scheduledTime && <p className="text-xs text-gray-600 mt-1">Slot: {fmt12(mood.scheduledTime)}</p>}
      </div>
    </div>
  );
};

export const MoodTimeline = ({ history }) => {
  if (!history?.length) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">🎙️</div>
        <p className="text-gray-400">No AI check-ins recorded yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {history.map((mood) => <MoodTimelineEntry key={mood._id} mood={mood} />)}
    </div>
  );
};
