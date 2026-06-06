import mongoose from 'mongoose';
import CognitiveSession from '../models/CognitiveSession.model.js';
import CognitiveAnalyticsEvent from '../models/CognitiveAnalyticsEvent.model.js';
import CognitiveAssignment from '../models/CognitiveAssignment.model.js';
import { assertPatientAccess } from '../utils/ownership.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const dateKey = (d) => startOfDay(d).toISOString().slice(0, 10);

/**
 * CognitiveAnalyticsService
 *
 * Two responsibilities:
 *   1. recordEvent() — append-only event ingestion used by other services.
 *   2. Aggregations — read models for the family & doctor dashboards.
 *
 * Aggregations favour MongoDB pipelines for grouped stats and lightweight JS
 * bucketing for day-by-day trends (clearer + timezone-stable for a single
 * patient over a bounded window).
 */
class CognitiveAnalyticsService {
  /**
   * Append a single analytics event. Non-fatal: failures are logged, never
   * thrown, so they cannot break the primary write that triggered them.
   */
  async recordEvent({ patientId, sessionId = null, type, kind = null, exerciseType = null, value = null, meta = {}, occurredAt }) {
    try {
      const when = occurredAt ? new Date(occurredAt) : new Date();
      await CognitiveAnalyticsEvent.create({
        patient: patientId,
        session: sessionId,
        type,
        kind,
        exerciseType,
        value,
        occurredAt: when,
        hourOfDay: when.getHours(),
        dayOfWeek: when.getDay(),
        meta,
      });
    } catch (err) {
      console.warn('[CognitiveAnalytics] recordEvent failed:', err.message);
    }
  }

  /**
   * Comprehensive analytics overview for one patient across the last `days`.
   * Shape is consumed directly by the family/doctor analytics dashboards.
   */
  async getOverview(patientId, ctx, days = 30) {
    await assertPatientAccess(patientId, ctx);

    const since = new Date(Date.now() - days * DAY_MS);
    const pid = new mongoose.Types.ObjectId(patientId);

    const sessions = await CognitiveSession.find({
      patient: pid,
      createdAt: { $gte: since },
    })
      .select('status score completionRate exerciseType kind title difficulty startedAt endedAt createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const completed = sessions.filter((s) => s.status === 'completed');
    const missed = sessions.filter((s) => s.status === 'missed');
    const abandoned = sessions.filter((s) => s.status === 'abandoned');

    // ── Summary ────────────────────────────────────────────────────────────
    const totalSessions = sessions.length;
    const completedCount = completed.length;
    const avgScore =
      completed.length > 0
        ? Math.round(completed.reduce((s, x) => s + (x.score || 0), 0) / completed.length)
        : 0;
    const completionRate =
      totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

    // ── Day-by-day trend ──────────────────────────────────────────────────
    const byDay = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const key = dateKey(new Date(Date.now() - i * DAY_MS));
      byDay.set(key, { date: key, total: 0, completed: 0, scoreSum: 0, scoreCount: 0 });
    }
    for (const s of sessions) {
      const key = dateKey(s.createdAt);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (s.status === 'completed') {
        bucket.completed += 1;
        if (typeof s.score === 'number') {
          bucket.scoreSum += s.score;
          bucket.scoreCount += 1;
        }
      }
    }
    const completionTrend = [...byDay.values()].map((b) => ({
      date: b.date,
      total: b.total,
      completed: b.completed,
      avgScore: b.scoreCount > 0 ? Math.round(b.scoreSum / b.scoreCount) : null,
    }));

    // ── Per-exercise performance (completed exercise sessions) ─────────────
    const perfMap = new Map();
    for (const s of completed) {
      if (s.kind !== 'exercise' || !s.exerciseType) continue;
      const m = perfMap.get(s.exerciseType) || { type: s.exerciseType, sessions: 0, scoreSum: 0 };
      m.sessions += 1;
      m.scoreSum += s.score || 0;
      perfMap.set(s.exerciseType, m);
    }
    const exercisePerformance = [...perfMap.values()]
      .map((m) => ({
        type: m.type,
        sessions: m.sessions,
        avgScore: m.sessions > 0 ? Math.round(m.scoreSum / m.sessions) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // ── Engagement & consistency ───────────────────────────────────────────
    const activeDays = new Set(
      sessions.filter((s) => s.status === 'completed').map((s) => dateKey(s.createdAt))
    );
    const consistency = Math.round((activeDays.size / days) * 100);
    const currentStreak = this._currentStreak(activeDays);
    const avgPerActiveDay =
      activeDays.size > 0 ? Math.round((completedCount / activeDays.size) * 10) / 10 : 0;

    // ── Best active hours (from events) ────────────────────────────────────
    const hourAgg = await CognitiveAnalyticsEvent.aggregate([
      { $match: { patient: pid, type: 'session_completed', occurredAt: { $gte: since } } },
      { $group: { _id: '$hourOfDay', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const bestHours = Array.from({ length: 24 }, (_, h) => {
      const found = hourAgg.find((x) => x._id === h);
      return { hour: h, count: found ? found.count : 0 };
    });

    // ── Memory interaction frequency ───────────────────────────────────────
    const interactionAgg = await CognitiveAnalyticsEvent.aggregate([
      {
        $match: {
          patient: pid,
          type: { $in: ['album_viewed', 'item_viewed'] },
          occurredAt: { $gte: since },
        },
      },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const memoryInteractions = {
      albumViews: interactionAgg.find((x) => x._id === 'album_viewed')?.count || 0,
      itemViews: interactionAgg.find((x) => x._id === 'item_viewed')?.count || 0,
    };

    return {
      rangeDays: days,
      summary: {
        totalSessions,
        completed: completedCount,
        missed: missed.length,
        abandoned: abandoned.length,
        completionRate,
        avgScore,
        activeDays: activeDays.size,
        consistency,
        currentStreak,
        avgPerActiveDay,
      },
      completionTrend,
      exercisePerformance,
      bestHours,
      memoryInteractions,
      recentSessions: sessions.slice(0, 10).map((s) => ({
        _id: s._id,
        title: s.title,
        kind: s.kind,
        exerciseType: s.exerciseType,
        difficulty: s.difficulty,
        status: s.status,
        score: s.score,
        completionRate: s.completionRate,
        createdAt: s.createdAt,
      })),
    };
  }

  /** Count consecutive active days ending today (or yesterday). */
  _currentStreak(activeDaysSet) {
    let streak = 0;
    let cursor = startOfDay(new Date());
    // Allow the streak to count from today; if nothing today, start at yesterday.
    if (!activeDaysSet.has(dateKey(cursor))) {
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    while (activeDaysSet.has(dateKey(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    return streak;
  }
}

export default new CognitiveAnalyticsService();
