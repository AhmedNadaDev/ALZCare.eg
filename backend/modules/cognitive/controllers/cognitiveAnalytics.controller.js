import service from '../services/cognitiveAnalytics.service.js';
import { ctxFromReq, resolvePatientId } from '../utils/ctx.js';

class CognitiveAnalyticsController {
  async overview(req, res, next) {
    try {
      const days = req.query.days ? Math.min(Number(req.query.days) || 30, 365) : 30;
      const data = await service.getOverview(resolvePatientId(req), ctxFromReq(req), days);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }
}

export default new CognitiveAnalyticsController();
