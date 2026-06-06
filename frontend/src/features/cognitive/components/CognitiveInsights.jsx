import React from 'react';
import { EXERCISE_META, statusColor, EmptyState, Spinner } from '../constants.jsx';

const StatCard = ({ label, value, sub, accent = 'text-white' }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <p className="text-xs text-gray-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

/** Vertical bars for the completion trend (last N days). */
const TrendChart = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex items-end gap-0.5 h-32">
      {data.map((d, i) => {
        const h = (d.total / max) * 100;
        const ch = d.total > 0 ? (d.completed / d.total) * h : 0;
        return (
          <div key={i} className="flex-1 flex flex-col justify-end group relative" title={`${d.date}: ${d.completed}/${d.total} completed`}>
            <div className="w-full rounded-t bg-white/10 relative" style={{ height: `${Math.max(h, 2)}%` }}>
              <div className="absolute bottom-0 left-0 right-0 rounded-t bg-gradient-to-t from-purple-600 to-violet-500" style={{ height: `${d.total > 0 ? (d.completed / d.total) * 100 : 0}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Horizontal bars for best active hours. */
const HoursChart = ({ hours }) => {
  const max = Math.max(1, ...hours.map((h) => h.count));
  const fmt = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  return (
    <div className="flex items-end gap-0.5 h-24">
      {hours.map((h) => (
        <div key={h.hour} className="flex-1 flex flex-col items-center justify-end" title={`${fmt(h.hour)}: ${h.count}`}>
          <div className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-blue-400" style={{ height: `${(h.count / max) * 100}%`, minHeight: h.count ? '4px' : '0' }} />
          {h.hour % 6 === 0 && <span className="text-[9px] text-gray-500 mt-1">{fmt(h.hour)}</span>}
        </div>
      ))}
    </div>
  );
};

/**
 * CognitiveInsights — presentational analytics dashboard. Used by both the
 * family monitoring tab and the doctor's read-only view.
 */
const CognitiveInsights = ({ analytics, loading, onRangeChange, range = 30 }) => {
  if (loading && !analytics) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!analytics) return <EmptyState icon="📊" title="No data yet" hint="Insights appear once the patient completes sessions." />;

  const s = analytics.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Progress & Insights</h3>
        <select
          value={range}
          onChange={(e) => onRangeChange?.(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200"
        >
          <option value={7} className="bg-[#150a2b]">Last 7 days</option>
          <option value={30} className="bg-[#150a2b]">Last 30 days</option>
          <option value={90} className="bg-[#150a2b]">Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sessions completed" value={s.completed ?? 0} sub={`${s.totalSessions ?? 0} total`} />
        <StatCard label="Completion rate" value={`${s.completionRate ?? 0}%`} accent="text-emerald-400" />
        <StatCard label="Average score" value={`${s.avgScore ?? 0}%`} accent="text-purple-300" />
        <StatCard label="Current streak" value={`${s.currentStreak ?? 0}d`} sub={`${s.consistency ?? 0}% consistent`} accent="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm font-medium text-gray-200 mb-4">Activity trend <span className="text-gray-500">(purple = completed)</span></p>
          <TrendChart data={analytics.completionTrend || []} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm font-medium text-gray-200 mb-4">Engagement</p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Active days</span><span className="text-white font-medium">{s.activeDays ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Avg / active day</span><span className="text-white font-medium">{s.avgPerActiveDay ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Missed</span><span className="text-red-300 font-medium">{s.missed ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Album views</span><span className="text-white font-medium">{analytics.memoryInteractions?.albumViews ?? 0}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm font-medium text-gray-200 mb-4">Exercise performance</p>
          {(analytics.exercisePerformance || []).length === 0 ? (
            <p className="text-sm text-gray-500">No completed exercises yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.exercisePerformance.map((e) => {
                const meta = EXERCISE_META[e.type] || {};
                return (
                  <div key={e.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{meta.emoji} {meta.label || e.type}</span>
                      <span className="text-gray-400">{e.avgScore}% · {e.sessions} {e.sessions === 1 ? 'session' : 'sessions'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${meta.gradient || 'from-purple-600 to-violet-500'}`} style={{ width: `${e.avgScore}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm font-medium text-gray-200 mb-4">Best active hours</p>
          <HoursChart hours={analytics.bestHours || []} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-medium text-gray-200 mb-4">Recent sessions</p>
        {(analytics.recentSessions || []).length === 0 ? (
          <p className="text-sm text-gray-500">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {analytics.recentSessions.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {(EXERCISE_META[r.exerciseType]?.emoji) || (r.kind === 'album' ? '📚' : '🧠')} {r.title || EXERCISE_META[r.exerciseType]?.label || 'Session'}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {typeof r.score === 'number' && <span className="text-sm font-medium text-purple-300">{r.score}%</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColor(r.status)}`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CognitiveInsights;
