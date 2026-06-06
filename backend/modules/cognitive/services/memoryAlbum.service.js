import MemoryAlbum from '../models/MemoryAlbum.model.js';
import MemoryItem from '../models/MemoryItem.model.js';
import CognitiveAssignment from '../models/CognitiveAssignment.model.js';
import CognitiveSchedule from '../models/CognitiveSchedule.model.js';
import { assertPatientAccess, modelFromRole } from '../utils/ownership.js';
import { deleteMemoryFile } from '../../../middlewares/uploadMedia.middleware.js';
import { cancelSchedule } from '../cognitive.scheduler.js';
import analytics from './cognitiveAnalytics.service.js';

const ALBUM_FIELDS = ['title', 'description', 'category', 'tags', 'emotion', 'coverImage', 'isActive'];
const ITEM_FIELDS = [
  'type', 'mediaUrl', 'thumbnailUrl', 'voiceNoteUrl', 'name',
  'relationship', 'story', 'emotion', 'takenAt', 'location', 'order',
];

/**
 * MemoryAlbumService
 *
 * CRUD for albums and their media items. Maintains the denormalized
 * `itemCount`, auto-promotes the first image to the album cover, and cleans up
 * uploaded files + dependent assignments/schedules on deletion.
 */
class MemoryAlbumService {
  // ── Albums ─────────────────────────────────────────────────────────────

  async listAlbums(patientId, ctx, { includeInactive = false } = {}) {
    await assertPatientAccess(patientId, ctx);
    const query = { patient: patientId };
    if (!includeInactive) query.isActive = true;
    return MemoryAlbum.find(query).sort({ createdAt: -1 });
  }

  async getAlbum(albumId, ctx) {
    const album = await MemoryAlbum.findById(albumId);
    if (!album) throw { status: 404, message: 'Album not found' };
    await assertPatientAccess(album.patient, ctx);
    const items = await MemoryItem.find({ album: album._id }).sort({ order: 1, createdAt: 1 });
    return { album, items };
  }

  async createAlbum({ patientId, data, ctx }) {
    await assertPatientAccess(patientId, ctx);
    const album = await MemoryAlbum.create({
      patient: patientId,
      createdBy: ctx.userId,
      createdByModel: modelFromRole(ctx.userRole),
      title: data.title,
      description: data.description,
      category: data.category || 'family',
      coverImage: data.coverImage || null,
      tags: this._normalizeTags(data.tags),
      emotion: data.emotion || 'neutral',
    });
    return album;
  }

  async updateAlbum({ albumId, data, ctx }) {
    const album = await MemoryAlbum.findById(albumId);
    if (!album) throw { status: 404, message: 'Album not found' };
    await assertPatientAccess(album.patient, ctx);

    ALBUM_FIELDS.forEach((f) => {
      if (data[f] !== undefined) {
        album[f] = f === 'tags' ? this._normalizeTags(data[f]) : data[f];
      }
    });
    await album.save();
    return album;
  }

  async deleteAlbum({ albumId, ctx }) {
    const album = await MemoryAlbum.findById(albumId);
    if (!album) throw { status: 404, message: 'Album not found' };
    await assertPatientAccess(album.patient, ctx);

    // Remove media files for all items.
    const items = await MemoryItem.find({ album: album._id });
    for (const item of items) {
      deleteMemoryFile(item.mediaUrl);
      deleteMemoryFile(item.thumbnailUrl);
      deleteMemoryFile(item.voiceNoteUrl);
    }
    await MemoryItem.deleteMany({ album: album._id });
    deleteMemoryFile(album.coverImage);

    // Cascade: drop assignments referencing this album + their schedules.
    const assignments = await CognitiveAssignment.find({ kind: 'album', album: album._id });
    for (const a of assignments) {
      const schedules = await CognitiveSchedule.find({ assignment: a._id });
      for (const s of schedules) {
        cancelSchedule(s._id.toString());
        await s.deleteOne();
      }
      await a.deleteOne();
    }

    await album.deleteOne();
    return { deleted: true };
  }

  // ── Items ───────────────────────────────────────────────────────────────

  async addItem({ albumId, data, ctx }) {
    const album = await MemoryAlbum.findById(albumId);
    if (!album) throw { status: 404, message: 'Album not found' };
    await assertPatientAccess(album.patient, ctx);

    const count = await MemoryItem.countDocuments({ album: album._id });
    const item = await MemoryItem.create({
      album: album._id,
      patient: album.patient,
      type: data.type || (data.mediaUrl ? 'image' : 'text'),
      mediaUrl: data.mediaUrl || null,
      thumbnailUrl: data.thumbnailUrl || null,
      voiceNoteUrl: data.voiceNoteUrl || null,
      name: data.name,
      relationship: data.relationship,
      story: data.story,
      emotion: data.emotion || 'neutral',
      takenAt: data.takenAt || null,
      location: data.location,
      order: typeof data.order === 'number' ? data.order : count,
      createdBy: ctx.userId,
      createdByModel: modelFromRole(ctx.userRole),
    });

    // Maintain counters / cover.
    const update = { $inc: { itemCount: 1 } };
    if (!album.coverImage && item.type === 'image' && item.mediaUrl) {
      update.$set = { coverImage: item.mediaUrl };
    }
    await MemoryAlbum.updateOne({ _id: album._id }, update);

    return item;
  }

  async updateItem({ itemId, data, ctx }) {
    const item = await MemoryItem.findById(itemId);
    if (!item) throw { status: 404, message: 'Memory item not found' };
    await assertPatientAccess(item.patient, ctx);

    // If replacing media, delete the old files first.
    if (data.mediaUrl && data.mediaUrl !== item.mediaUrl) deleteMemoryFile(item.mediaUrl);
    if (data.voiceNoteUrl && data.voiceNoteUrl !== item.voiceNoteUrl) deleteMemoryFile(item.voiceNoteUrl);

    ITEM_FIELDS.forEach((f) => {
      if (data[f] !== undefined) item[f] = data[f];
    });
    await item.save();
    return item;
  }

  async deleteItem({ itemId, ctx }) {
    const item = await MemoryItem.findById(itemId);
    if (!item) throw { status: 404, message: 'Memory item not found' };
    await assertPatientAccess(item.patient, ctx);

    deleteMemoryFile(item.mediaUrl);
    deleteMemoryFile(item.thumbnailUrl);
    deleteMemoryFile(item.voiceNoteUrl);

    const albumId = item.album;
    await item.deleteOne();
    await MemoryAlbum.updateOne({ _id: albumId, itemCount: { $gt: 0 } }, { $inc: { itemCount: -1 } });

    return { deleted: true };
  }

  async reorderItems({ albumId, order, ctx }) {
    const album = await MemoryAlbum.findById(albumId);
    if (!album) throw { status: 404, message: 'Album not found' };
    await assertPatientAccess(album.patient, ctx);
    if (!Array.isArray(order)) throw { status: 400, message: 'order must be an array of item ids' };

    await Promise.all(
      order.map((itemId, idx) =>
        MemoryItem.updateOne({ _id: itemId, album: album._id }, { $set: { order: idx } })
      )
    );
    return MemoryItem.find({ album: album._id }).sort({ order: 1 });
  }

  /** Album-level view event (engagement analytics for the patient experience). */
  async logAlbumView(albumId, ctx) {
    const album = await MemoryAlbum.findById(albumId);
    if (!album) throw { status: 404, message: 'Album not found' };
    await assertPatientAccess(album.patient, ctx);
    await analytics.recordEvent({ patientId: album.patient, type: 'album_viewed', kind: 'album', meta: { albumId } });
    return { ok: true };
  }

  _normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
    if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20);
    return [];
  }
}

export default new MemoryAlbumService();
