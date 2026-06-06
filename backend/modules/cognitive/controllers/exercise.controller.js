import service from '../services/exercise.service.js';
import { ctxFromReq, resolvePatientId } from '../utils/ctx.js';

class ExerciseController {
  async listTemplates(req, res, next) {
    try {
      const templates = await service.listTemplates({ activeOnly: req.query.all !== 'true' });
      res.json({ success: true, data: templates });
    } catch (e) {
      next(e);
    }
  }

  async listAssignments(req, res, next) {
    try {
      const data = await service.listAssignments(resolvePatientId(req), ctxFromReq(req), {
        kind: req.query.kind,
      });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async createExercise(req, res, next) {
    try {
      const assignment = await service.createExerciseAssignment({
        patientId: resolvePatientId(req),
        data: req.body,
        ctx: ctxFromReq(req),
      });
      res.status(201).json({ success: true, data: assignment });
    } catch (e) {
      next(e);
    }
  }

  async createAlbum(req, res, next) {
    try {
      const assignment = await service.createAlbumAssignment({
        patientId: resolvePatientId(req),
        data: req.body,
        ctx: ctxFromReq(req),
      });
      res.status(201).json({ success: true, data: assignment });
    } catch (e) {
      next(e);
    }
  }

  async update(req, res, next) {
    try {
      const assignment = await service.updateAssignment({
        assignmentId: req.params.assignmentId,
        data: req.body,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: assignment });
    } catch (e) {
      next(e);
    }
  }

  async setEnabled(req, res, next) {
    try {
      const assignment = await service.setEnabled({
        assignmentId: req.params.assignmentId,
        enabled: req.body.enabled,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: assignment });
    } catch (e) {
      next(e);
    }
  }

  async remove(req, res, next) {
    try {
      const result = await service.removeAssignment({
        assignmentId: req.params.assignmentId,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export default new ExerciseController();
