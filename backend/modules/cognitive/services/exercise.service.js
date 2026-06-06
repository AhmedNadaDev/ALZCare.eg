import ExerciseTemplate from '../models/ExerciseTemplate.model.js';
import CognitiveAssignment from '../models/CognitiveAssignment.model.js';
import CognitiveSchedule from '../models/CognitiveSchedule.model.js';
import MemoryAlbum from '../models/MemoryAlbum.model.js';
import { assertPatientAccess, modelFromRole } from '../utils/ownership.js';
import { cancelSchedule } from '../cognitive.scheduler.js';
import analytics from './cognitiveAnalytics.service.js';

/**
 * ExerciseService
 *
 * Owns two concepts:
 *   - ExerciseTemplate: the global, data-driven catalogue of exercises.
 *   - CognitiveAssignment: a template OR album made active for a patient with
 *     per-patient configuration (difficulty, duration, enable/disable, config).
 *
 * Family/doctor "enable or disable a game for a patient" maps to the
 * assignment's `enabled` flag — never to the global template — so one
 * caregiver's choice can't affect another patient.
 */
class ExerciseService {
  // ── Templates (catalogue) ────────────────────────────────────────────────

  async listTemplates({ activeOnly = true } = {}) {
    const query = activeOnly ? { isActive: true } : {};
    return ExerciseTemplate.find(query).sort({ order: 1, name: 1 });
  }

  // ── Assignments (PatientAssignments) ──────────────────────────────────────

  async listAssignments(patientId, ctx, { kind } = {}) {
    await assertPatientAccess(patientId, ctx);
    const query = { patient: patientId };
    if (kind) query.kind = kind;
    return CognitiveAssignment.find(query)
      .populate('exerciseTemplate', 'name type icon description skills defaultDurationSec')
      .populate('album', 'title coverImage emotion itemCount')
      .sort({ createdAt: -1 });
  }

  async createExerciseAssignment({ patientId, data, ctx }) {
    await assertPatientAccess(patientId, ctx);

    const template = await ExerciseTemplate.findById(data.exerciseTemplateId);
    if (!template || !template.isActive) {
      throw { status: 400, message: 'Exercise template not found or inactive' };
    }

    const difficulty = ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'easy';

    const assignment = await CognitiveAssignment.create({
      patient: patientId,
      kind: 'exercise',
      exerciseTemplate: template._id,
      exerciseType: template.type,
      album: null,
      title: data.title || template.name,
      difficulty,
      durationSec: data.durationSec || template.defaultDurationSec,
      config: data.config || {},
      enabled: data.enabled !== false,
      autoStart: !!data.autoStart,
      createdBy: ctx.userId,
      createdByModel: modelFromRole(ctx.userRole),
    });

    await analytics.recordEvent({
      patientId,
      type: 'assignment_created',
      kind: 'exercise',
      exerciseType: template.type,
    });

    return this._populate(assignment._id);
  }

  async createAlbumAssignment({ patientId, data, ctx }) {
    await assertPatientAccess(patientId, ctx);

    const album = await MemoryAlbum.findById(data.albumId);
    if (!album || album.patient.toString() !== patientId.toString()) {
      throw { status: 400, message: 'Album not found for this patient' };
    }

    // Prevent duplicate album assignments.
    const existing = await CognitiveAssignment.findOne({
      patient: patientId,
      kind: 'album',
      album: album._id,
    });
    if (existing) return this._populate(existing._id);

    const assignment = await CognitiveAssignment.create({
      patient: patientId,
      kind: 'album',
      album: album._id,
      title: data.title || album.title,
      difficulty: 'easy',
      durationSec: data.durationSec || 0,
      config: data.config || {},
      enabled: data.enabled !== false,
      autoStart: !!data.autoStart,
      createdBy: ctx.userId,
      createdByModel: modelFromRole(ctx.userRole),
    });

    await analytics.recordEvent({ patientId, type: 'assignment_created', kind: 'album' });
    return this._populate(assignment._id);
  }

  async updateAssignment({ assignmentId, data, ctx }) {
    const assignment = await CognitiveAssignment.findById(assignmentId);
    if (!assignment) throw { status: 404, message: 'Assignment not found' };
    await assertPatientAccess(assignment.patient, ctx);

    const allowed = ['title', 'difficulty', 'durationSec', 'config', 'enabled', 'autoStart'];
    allowed.forEach((f) => {
      if (data[f] !== undefined) assignment[f] = data[f];
    });
    await assignment.save();
    return this._populate(assignment._id);
  }

  async setEnabled({ assignmentId, enabled, ctx }) {
    const assignment = await CognitiveAssignment.findById(assignmentId);
    if (!assignment) throw { status: 404, message: 'Assignment not found' };
    await assertPatientAccess(assignment.patient, ctx);

    assignment.enabled = !!enabled;
    await assignment.save();

    // Disabling an assignment deactivates its schedules so nothing fires.
    if (!assignment.enabled) {
      const schedules = await CognitiveSchedule.find({ assignment: assignment._id });
      for (const s of schedules) {
        s.isActive = false;
        await s.save();
        cancelSchedule(s._id.toString());
      }
    }
    return assignment;
  }

  async removeAssignment({ assignmentId, ctx }) {
    const assignment = await CognitiveAssignment.findById(assignmentId);
    if (!assignment) throw { status: 404, message: 'Assignment not found' };
    await assertPatientAccess(assignment.patient, ctx);

    // Cascade: remove schedules (and their in-memory timers).
    const schedules = await CognitiveSchedule.find({ assignment: assignment._id });
    for (const s of schedules) {
      cancelSchedule(s._id.toString());
      await s.deleteOne();
    }
    await assignment.deleteOne();
    return { deleted: true };
  }

  _populate(id) {
    return CognitiveAssignment.findById(id)
      .populate('exerciseTemplate', 'name type icon description skills defaultDurationSec')
      .populate('album', 'title coverImage emotion itemCount');
  }
}

export default new ExerciseService();
