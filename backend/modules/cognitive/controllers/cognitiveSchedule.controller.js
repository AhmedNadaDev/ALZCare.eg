import service from '../services/cognitiveSchedule.service.js';
import { ctxFromReq, resolvePatientId } from '../utils/ctx.js';

class CognitiveScheduleController {
  async list(req, res, next) {
    try {
      const data = await service.list(resolvePatientId(req), ctxFromReq(req));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    try {
      const schedule = await service.create({
        patientId: resolvePatientId(req),
        data: req.body,
        ctx: ctxFromReq(req),
      });
      res.status(201).json({ success: true, data: schedule });
    } catch (e) {
      next(e);
    }
  }

  async update(req, res, next) {
    try {
      const schedule = await service.update({
        scheduleId: req.params.scheduleId,
        data: req.body,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: schedule });
    } catch (e) {
      next(e);
    }
  }

  async setActive(req, res, next) {
    try {
      const schedule = await service.setActive({
        scheduleId: req.params.scheduleId,
        isActive: req.body.isActive,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: schedule });
    } catch (e) {
      next(e);
    }
  }

  async remove(req, res, next) {
    try {
      const result = await service.remove({ scheduleId: req.params.scheduleId, ctx: ctxFromReq(req) });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export default new CognitiveScheduleController();
