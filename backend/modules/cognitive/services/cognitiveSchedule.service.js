import CognitiveSchedule from '../models/CognitiveSchedule.model.js';
import CognitiveAssignment from '../models/CognitiveAssignment.model.js';
import { assertPatientAccess, modelFromRole } from '../utils/ownership.js';
import { syncSchedule, cancelSchedule } from '../cognitive.scheduler.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * CognitiveScheduleService
 *
 * CRUD for recurrence rules. After every mutation it tells the in-process
 * scheduler to (re)sync timers, mirroring the DailyPlan approach so changes
 * take effect immediately without waiting for the next cron tick.
 */
class CognitiveScheduleService {
  async create({ patientId, data, ctx }) {
    await assertPatientAccess(patientId, ctx);

    const assignment = await CognitiveAssignment.findById(data.assignmentId);
    if (!assignment || assignment.patient.toString() !== patientId.toString()) {
      throw { status: 400, message: 'Invalid assignment for this patient' };
    }
    if (!data.time || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.time)) {
      throw { status: 400, message: 'A valid time (HH:MM) is required' };
    }

    const recurrence = data.recurrence || 'daily';
    const daysOfWeek = this._sanitizeDays(data.daysOfWeek, recurrence);

    const schedule = await CognitiveSchedule.create({
      patient: patientId,
      assignment: assignment._id,
      title: data.title || assignment.title,
      recurrence,
      daysOfWeek,
      time: data.time,
      date: recurrence === 'once' ? data.date || new Date() : null,
      isActive: data.isActive !== false,
      createdBy: ctx.userId,
      createdByModel: modelFromRole(ctx.userRole),
    });

    if (schedule.isActive) syncSchedule(schedule);
    return this._populate(schedule._id);
  }

  async list(patientId, ctx) {
    await assertPatientAccess(patientId, ctx);
    return CognitiveSchedule.find({ patient: patientId })
      .populate({
        path: 'assignment',
        select: 'kind title difficulty exerciseType album exerciseTemplate enabled',
        populate: [
          { path: 'exerciseTemplate', select: 'name type icon' },
          { path: 'album', select: 'title coverImage emotion' },
        ],
      })
      .sort({ time: 1 });
  }

  async update({ scheduleId, data, ctx }) {
    const schedule = await CognitiveSchedule.findById(scheduleId);
    if (!schedule) throw { status: 404, message: 'Schedule not found' };
    await assertPatientAccess(schedule.patient, ctx);

    const allowed = ['title', 'recurrence', 'daysOfWeek', 'time', 'date', 'isActive'];
    allowed.forEach((f) => {
      if (data[f] !== undefined) schedule[f] = data[f];
    });
    if (data.time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.time)) {
      throw { status: 400, message: 'A valid time (HH:MM) is required' };
    }
    schedule.daysOfWeek = this._sanitizeDays(schedule.daysOfWeek, schedule.recurrence);
    await schedule.save();

    // Re-sync timers: cancel old, then schedule fresh if still active.
    cancelSchedule(schedule._id.toString());
    if (schedule.isActive) syncSchedule(schedule);

    return this._populate(schedule._id);
  }

  async setActive({ scheduleId, isActive, ctx }) {
    const schedule = await CognitiveSchedule.findById(scheduleId);
    if (!schedule) throw { status: 404, message: 'Schedule not found' };
    await assertPatientAccess(schedule.patient, ctx);

    schedule.isActive = !!isActive;
    await schedule.save();

    cancelSchedule(schedule._id.toString());
    if (schedule.isActive) syncSchedule(schedule);
    return schedule;
  }

  async remove({ scheduleId, ctx }) {
    const schedule = await CognitiveSchedule.findById(scheduleId);
    if (!schedule) throw { status: 404, message: 'Schedule not found' };
    await assertPatientAccess(schedule.patient, ctx);

    cancelSchedule(schedule._id.toString());
    await schedule.deleteOne();
    return { deleted: true };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _sanitizeDays(days, recurrence) {
    if (recurrence === 'daily' || recurrence === 'once') return [];
    if (!Array.isArray(days)) return [];
    return days.filter((d) => DAYS.includes(d));
  }

  _populate(id) {
    return CognitiveSchedule.findById(id).populate({
      path: 'assignment',
      select: 'kind title difficulty exerciseType album exerciseTemplate enabled',
      populate: [
        { path: 'exerciseTemplate', select: 'name type icon' },
        { path: 'album', select: 'title coverImage emotion' },
      ],
    });
  }
}

export default new CognitiveScheduleService();
