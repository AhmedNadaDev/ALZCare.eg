import service from '../services/cognitiveSession.service.js';
import { ctxFromReq, resolvePatientId } from '../utils/ctx.js';

class CognitiveSessionController {
  /** POST /cognitive/sessions/start  { assignmentId } — start a new session now. */
  async start(req, res, next) {
    try {
      const { assignmentId } = req.body;
      if (!assignmentId) {
        return res.status(400).json({ success: false, message: 'assignmentId is required' });
      }
      const { session, content } = await service.startFromAssignment({
        assignmentId,
        ctx: ctxFromReq(req),
      });
      res.status(201).json({ success: true, data: { session, content } });
    } catch (e) {
      next(e);
    }
  }

  /** POST /cognitive/sessions/:sessionId/start — start/resume an existing (scheduled) session. */
  async startExisting(req, res, next) {
    try {
      const { session, content } = await service.startSession({
        sessionId: req.params.sessionId,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: { session, content } });
    } catch (e) {
      next(e);
    }
  }

  async recordInteraction(req, res, next) {
    try {
      const result = await service.recordInteraction({
        sessionId: req.params.sessionId,
        interaction: req.body.interaction || req.body,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async complete(req, res, next) {
    try {
      const session = await service.completeSession({
        sessionId: req.params.sessionId,
        interactions: req.body.interactions,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: session });
    } catch (e) {
      next(e);
    }
  }

  async abandon(req, res, next) {
    try {
      const session = await service.abandonSession({
        sessionId: req.params.sessionId,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: session });
    } catch (e) {
      next(e);
    }
  }

  async get(req, res, next) {
    try {
      const session = await service.getSession(req.params.sessionId, ctxFromReq(req));
      res.json({ success: true, data: session });
    } catch (e) {
      next(e);
    }
  }

  async history(req, res, next) {
    try {
      const data = await service.getPatientSessions(resolvePatientId(req), ctxFromReq(req), {
        status: req.query.status,
        days: req.query.days ? Number(req.query.days) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async due(req, res, next) {
    try {
      const data = await service.getDueSessions(resolvePatientId(req), ctxFromReq(req));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }
}

export default new CognitiveSessionController();
