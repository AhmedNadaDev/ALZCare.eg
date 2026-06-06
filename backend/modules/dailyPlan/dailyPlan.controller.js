import dailyPlanService from './dailyPlan.service.js';

class DailyPlanController {
  /**
   * POST /api/family/daily-plan
   * Create or update (upsert) a full daily plan for the authenticated family's patient.
   */
  async upsertDailyPlan(req, res, next) {
    try {
      const { date, events } = req.body;
      const patientId = req.patientId || req.body.patientId;

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId is required' });
      }

      const plan = await dailyPlanService.upsertDailyPlan({
        patientId,
        date,
        events,
        createdById: req.user._id,
        createdByModel: req.userRole === 'doctor' ? 'Doctor' : 'Family'
      });

      res.status(200).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/family/daily-plan/events
   * Append one or more events to a day's plan.
   */
  async addEvents(req, res, next) {
    try {
      const { date, events } = req.body;
      const patientId = req.patientId || req.body.patientId;

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId is required' });
      }
      if (!events || !events.length) {
        return res.status(400).json({ success: false, message: 'events array is required' });
      }

      const plan = await dailyPlanService.addEventsToPlan({
        patientId,
        date,
        events,
        createdById: req.user._id,
        createdByModel: req.userRole === 'doctor' ? 'Doctor' : 'Family'
      });

      res.status(200).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/patient/:id/daily-plan/today
   * Return today's plan for the given patient (patient, family, or doctor).
   */
  async getTodayPlan(req, res, next) {
    try {
      const patientId = req.params.id;
      const plan = await dailyPlanService.getTodayPlan(patientId);

      res.status(200).json({
        success: true,
        data: plan || null
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/patient/:id/daily-plan?date=YYYY-MM-DD
   * Return a plan for a specific date.
   */
  async getPlanByDate(req, res, next) {
    try {
      const patientId = req.params.id;
      const { date } = req.query;
      const plan = await dailyPlanService.getPlanByDate(patientId, date);

      res.status(200).json({ success: true, data: plan || null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/daily-plan/:planId/event/:eventId/respond
   * Patient (or system) submits a voice response for an event.
   */
  async respondToEvent(req, res, next) {
    try {
      const { planId, eventId } = req.params;
      const { responseText, patientId } = req.body;

      if (!responseText) {
        return res.status(400).json({ success: false, message: 'responseText is required' });
      }

      const result = await dailyPlanService.respondToEvent({
        planId,
        eventId,
        responseText,
        patientId: patientId || req.patientId
      });

      res.status(200).json({
        success: true,
        data: {
          event:           result.event,
          action:          result.action,
          status:          result.status,
          intent:          result.intent,
          confidence:      result.confidence,      // 0-100
          risk_level:      result.risk_level,
          decision_source: result.decision_source,
          reasoning:       result.reasoning,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/daily-plan/:planId/event/:eventId/manual
   * Manual confirm / override by family.
   */
  async manualConfirmEvent(req, res, next) {
    try {
      const { planId, eventId } = req.params;
      const { status } = req.body;

      if (!['completed', 'missed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be completed or missed' });
      }

      const result = await dailyPlanService.manualConfirmEvent({ planId, eventId, status });
      res.status(200).json({ success: true, data: result.event });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/family/daily-plan/:planId/event/:eventId
   * Update an event (family only).
   */
  async updateEvent(req, res, next) {
    try {
      const { planId, eventId } = req.params;

      const result = await dailyPlanService.updateEvent({
        planId,
        eventId,
        updateData: req.body
      });

      res.status(200).json({ success: true, data: result.event });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/family/daily-plan/:planId/event/:eventId
   * Remove an event (family only).
   */
  async deleteEvent(req, res, next) {
    try {
      const { planId, eventId } = req.params;

      const plan = await dailyPlanService.deleteEvent({ planId, eventId });

      res.status(200).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }
}

export default new DailyPlanController();
