import CognitiveSession from '../models/CognitiveSession.model.js';
import CognitiveAssignment from '../models/CognitiveAssignment.model.js';
import MemoryItem from '../models/MemoryItem.model.js';
import { emitToPatientRoom } from '../../socket/socketManager.js';
import { buildExerciseContent, scoreExercise } from '../utils/exerciseEngine.js';
import { assertPatientAccess, modelFromRole } from '../utils/ownership.js';
import analytics from './cognitiveAnalytics.service.js';

const ABANDON_AFTER_MIN = 30; // active sessions idle this long → abandoned
const MISS_AFTER_MIN = 45; // scheduled sessions never started this long → missed

/**
 * CognitiveSessionService
 *
 * The session engine — every interaction with cognitive content runs through
 * a session with a strict lifecycle:
 *   scheduled → active → completed | abandoned
 *   scheduled → missed (never started)
 *
 * Scoring is authoritative: content (with answer keys) is persisted at start
 * and re-scored at completion.
 */
class CognitiveSessionService {
  // ── Content building ───────────────────────────────────────────────────

  async _loadAssignment(assignmentId) {
    const assignment = await CognitiveAssignment.findById(assignmentId)
      .populate('exerciseTemplate')
      .populate('album', 'title description category coverImage emotion');
    if (!assignment) throw { status: 404, message: 'Assignment not found' };
    return assignment;
  }

  /** Produce the playable content + descriptive fields for an assignment. */
  async _buildContent(assignment) {
    if (assignment.kind === 'exercise') {
      const template = assignment.exerciseTemplate;
      if (!template) throw { status: 400, message: 'Exercise template missing for this assignment' };
      const mergedConfig = { ...(template.defaultConfig || {}), ...(assignment.config || {}) };
      const content = await buildExerciseContent({
        type: template.type,
        difficulty: assignment.difficulty,
        config: mergedConfig,
        patientId: assignment.patient,
      });
      return {
        kind: 'exercise',
        content,
        exerciseType: template.type,
        exerciseTemplate: template._id,
        album: null,
        title: assignment.title || template.name,
      };
    }

    // Album session
    if (!assignment.album) throw { status: 400, message: 'Album missing for this assignment' };
    const items = await MemoryItem.find({ album: assignment.album._id })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    const content = {
      type: 'album',
      ready: items.length > 0,
      reason: items.length === 0 ? 'This album has no memories yet.' : undefined,
      instructions: 'Look through each memory at your own pace.',
      album: {
        _id: assignment.album._id,
        title: assignment.album.title,
        description: assignment.album.description,
        coverImage: assignment.album.coverImage,
        emotion: assignment.album.emotion,
      },
      items: items.map((it) => ({
        _id: it._id,
        type: it.type,
        mediaUrl: it.mediaUrl,
        thumbnailUrl: it.thumbnailUrl,
        voiceNoteUrl: it.voiceNoteUrl,
        name: it.name,
        relationship: it.relationship,
        story: it.story,
        emotion: it.emotion,
        takenAt: it.takenAt,
        location: it.location,
      })),
      totalRounds: items.length,
    };
    return {
      kind: 'album',
      content,
      exerciseType: null,
      exerciseTemplate: null,
      album: assignment.album._id,
      title: assignment.title || assignment.album.title,
    };
  }

  // ── Manual start (patient/family/doctor initiates) ───────────────────────

  async startFromAssignment({ assignmentId, ctx }) {
    const assignment = await this._loadAssignment(assignmentId);
    await assertPatientAccess(assignment.patient, ctx);
    if (!assignment.enabled) throw { status: 400, message: 'This activity is currently disabled' };

    const built = await this._buildContent(assignment);

    const session = await CognitiveSession.create({
      patient: assignment.patient,
      assignment: assignment._id,
      schedule: null,
      kind: built.kind,
      exerciseTemplate: built.exerciseTemplate,
      exerciseType: built.exerciseType,
      album: built.album,
      title: built.title,
      difficulty: assignment.difficulty,
      status: 'active',
      source: 'manual',
      startedAt: new Date(),
      content: built.content,
      createdBy: ctx.userId,
      createdByModel: modelFromRole(ctx.userRole),
    });

    await analytics.recordEvent({
      patientId: assignment.patient,
      sessionId: session._id,
      type: 'session_started',
      kind: built.kind,
      exerciseType: built.exerciseType,
    });

    return { session, content: built.content };
  }

  // ── Scheduled session creation (called by the scheduler, no user ctx) ────

  async createScheduledSession({ assignment, schedule }) {
    const session = await CognitiveSession.create({
      patient: assignment.patient,
      assignment: assignment._id,
      schedule: schedule._id,
      kind: assignment.kind,
      exerciseType: assignment.kind === 'exercise' ? assignment.exerciseType || null : null,
      album: assignment.kind === 'album' ? assignment.album : null,
      title: schedule.title || assignment.title || 'Cognitive session',
      difficulty: assignment.difficulty,
      status: 'scheduled',
      source: 'scheduled',
      content: null,
      createdBy: schedule.createdBy,
      createdByModel: 'System',
    });

    await analytics.recordEvent({
      patientId: assignment.patient,
      sessionId: session._id,
      type: 'schedule_triggered',
      kind: assignment.kind,
      exerciseType: session.exerciseType,
    });

    emitToPatientRoom(assignment.patient.toString(), 'cognitive:session-due', {
      session: {
        _id: session._id,
        title: session.title,
        kind: session.kind,
        exerciseType: session.exerciseType,
        difficulty: session.difficulty,
        assignmentId: assignment._id,
      },
      autoStart: !!assignment.autoStart,
    });

    return session;
  }

  // ── Start / resume an existing session (patient opens it) ────────────────

  async startSession({ sessionId, ctx }) {
    const session = await CognitiveSession.findById(sessionId);
    if (!session) throw { status: 404, message: 'Session not found' };
    await assertPatientAccess(session.patient, ctx);

    if (['completed', 'abandoned', 'missed'].includes(session.status)) {
      throw { status: 400, message: `Session already ${session.status}` };
    }

    if (session.status === 'active' && session.content) {
      return { session, content: session.content }; // resume
    }

    // Transition scheduled → active and generate content now.
    const assignment = await this._loadAssignment(session.assignment);
    const built = await this._buildContent(assignment);

    session.status = 'active';
    session.startedAt = new Date();
    session.content = built.content;
    session.exerciseType = built.exerciseType;
    session.exerciseTemplate = built.exerciseTemplate;
    session.album = built.album;
    session.title = built.title;
    await session.save();

    await analytics.recordEvent({
      patientId: session.patient,
      sessionId: session._id,
      type: 'session_started',
      kind: session.kind,
      exerciseType: session.exerciseType,
    });

    return { session, content: built.content };
  }

  // ── Incremental interaction (album views, optional per-answer) ───────────

  async recordInteraction({ sessionId, interaction, ctx }) {
    const session = await CognitiveSession.findById(sessionId);
    if (!session) throw { status: 404, message: 'Session not found' };
    await assertPatientAccess(session.patient, ctx);
    if (session.status !== 'active') {
      throw { status: 400, message: 'Session is not active' };
    }

    const normalized = this._normalizeInteraction(interaction);
    session.interactions.push(normalized);
    await session.save();

    // Lightweight analytics for engagement-level events.
    if (normalized.kind === 'view') {
      await analytics.recordEvent({
        patientId: session.patient,
        sessionId: session._id,
        type: 'item_viewed',
        kind: session.kind,
        meta: { refId: normalized.refId },
      });
    } else if (normalized.correct === true) {
      await analytics.recordEvent({
        patientId: session.patient,
        sessionId: session._id,
        type: 'answer_correct',
        kind: session.kind,
        exerciseType: session.exerciseType,
      });
    } else if (normalized.correct === false) {
      await analytics.recordEvent({
        patientId: session.patient,
        sessionId: session._id,
        type: 'answer_wrong',
        kind: session.kind,
        exerciseType: session.exerciseType,
      });
    }

    return { ok: true, count: session.interactions.length };
  }

  // ── Completion ───────────────────────────────────────────────────────────

  async completeSession({ sessionId, interactions, ctx }) {
    const session = await CognitiveSession.findById(sessionId);
    if (!session) throw { status: 404, message: 'Session not found' };
    await assertPatientAccess(session.patient, ctx);
    if (session.status === 'completed') {
      return session; // idempotent
    }
    if (!['active', 'scheduled'].includes(session.status)) {
      throw { status: 400, message: `Cannot complete a ${session.status} session` };
    }

    // Authoritative interaction set: provided array wins, else accumulated.
    if (Array.isArray(interactions) && interactions.length) {
      session.interactions = interactions.map((i) => this._normalizeInteraction(i));
    }

    const result = this._score(session);

    const endedAt = new Date();
    const durationSec = session.startedAt
      ? Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000))
      : 0;

    session.status = 'completed';
    session.endedAt = endedAt;
    session.durationSec = durationSec;
    session.score = result.score;
    session.completionRate = result.completionRate;
    session.mistakes = result.mistakes;
    session.result = {
      ...result,
      durationSec,
      difficulty: session.difficulty,
      detail: { interactionCount: session.interactions.length },
    };
    await session.save();

    await analytics.recordEvent({
      patientId: session.patient,
      sessionId: session._id,
      type: 'session_completed',
      kind: session.kind,
      exerciseType: session.exerciseType,
      value: result.score,
    });

    emitToPatientRoom(session.patient.toString(), 'cognitive:session-completed', {
      session: {
        _id: session._id,
        title: session.title,
        kind: session.kind,
        exerciseType: session.exerciseType,
        score: session.score,
        completionRate: session.completionRate,
        status: session.status,
      },
    });

    return session;
  }

  async abandonSession({ sessionId, ctx }) {
    const session = await CognitiveSession.findById(sessionId);
    if (!session) throw { status: 404, message: 'Session not found' };
    await assertPatientAccess(session.patient, ctx);
    if (['completed', 'abandoned', 'missed'].includes(session.status)) return session;

    session.status = 'abandoned';
    session.endedAt = new Date();
    if (session.startedAt) {
      session.durationSec = Math.max(0, Math.round((session.endedAt - session.startedAt) / 1000));
    }
    await session.save();

    await analytics.recordEvent({
      patientId: session.patient,
      sessionId: session._id,
      type: 'session_abandoned',
      kind: session.kind,
      exerciseType: session.exerciseType,
    });
    return session;
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async getSession(sessionId, ctx) {
    const session = await CognitiveSession.findById(sessionId)
      .populate('album', 'title coverImage emotion')
      .populate('exerciseTemplate', 'name type icon');
    if (!session) throw { status: 404, message: 'Session not found' };
    await assertPatientAccess(session.patient, ctx);
    return session;
  }

  async getPatientSessions(patientId, ctx, { status, days = 30, limit = 50 } = {}) {
    await assertPatientAccess(patientId, ctx);
    const query = { patient: patientId };
    if (status) query.status = status;
    if (days) query.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };

    return CognitiveSession.find(query)
      .select('-content -interactions')
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));
  }

  /** Sessions still awaiting the patient (scheduled or active) for "today". */
  async getDueSessions(patientId, ctx) {
    await assertPatientAccess(patientId, ctx);
    return CognitiveSession.find({
      patient: patientId,
      status: { $in: ['scheduled', 'active'] },
    })
      .select('-content -interactions')
      .sort({ createdAt: -1 })
      .limit(50);
  }

  // ── Stale sweep (called by the scheduler) ────────────────────────────────

  async sweepStale() {
    const now = Date.now();
    const abandonCutoff = new Date(now - ABANDON_AFTER_MIN * 60 * 1000);
    const missCutoff = new Date(now - MISS_AFTER_MIN * 60 * 1000);

    const stale = await CognitiveSession.find({
      $or: [
        { status: 'active', updatedAt: { $lt: abandonCutoff } },
        { status: 'scheduled', createdAt: { $lt: missCutoff } },
      ],
    });

    for (const session of stale) {
      const newStatus = session.status === 'active' ? 'abandoned' : 'missed';
      session.status = newStatus;
      session.endedAt = new Date();
      if (session.startedAt) {
        session.durationSec = Math.max(0, Math.round((session.endedAt - session.startedAt) / 1000));
      }
      await session.save();

      await analytics.recordEvent({
        patientId: session.patient,
        sessionId: session._id,
        type: newStatus === 'abandoned' ? 'session_abandoned' : 'session_missed',
        kind: session.kind,
        exerciseType: session.exerciseType,
      });
    }

    if (stale.length > 0) {
      console.log(`[Cognitive] Swept ${stale.length} stale session(s)`);
    }
    return stale.length;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _normalizeInteraction(i = {}) {
    return {
      at: i.at ? new Date(i.at) : new Date(),
      kind: i.kind || 'answer',
      refId: i.refId || null,
      prompt: i.prompt ?? null,
      answer: i.answer ?? null,
      correct: typeof i.correct === 'boolean' ? i.correct : null,
      responseMs: typeof i.responseMs === 'number' ? i.responseMs : null,
      meta: i.meta || {},
    };
  }

  _score(session) {
    const content = session.content || {};
    const interactions = session.interactions || [];

    if (session.kind === 'album') {
      const total = content.totalRounds || (content.items ? content.items.length : 0);
      const viewed = new Set(
        interactions.filter((i) => i.kind === 'view' && i.refId).map((i) => i.refId.toString())
      ).size;
      const completionRate = total > 0 ? Math.round((viewed / total) * 100) : 100;
      return { score: completionRate, completionRate, correct: viewed, total, mistakes: 0 };
    }

    // Exercise scoring is delegated to the data-driven engine.
    return scoreExercise({ content, interactions });
  }
}

export default new CognitiveSessionService();
