import service from '../services/memoryAlbum.service.js';
import { ctxFromReq, resolvePatientId } from '../utils/ctx.js';
import { memoryFileUrl } from '../../../middlewares/uploadMedia.middleware.js';

const typeFromMime = (mime = '') => {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return 'image';
};

class MemoryAlbumController {
  async list(req, res, next) {
    try {
      const albums = await service.listAlbums(resolvePatientId(req), ctxFromReq(req), {
        includeInactive: req.query.includeInactive === 'true',
      });
      res.json({ success: true, data: albums });
    } catch (e) {
      next(e);
    }
  }

  async get(req, res, next) {
    try {
      const data = await service.getAlbum(req.params.albumId, ctxFromReq(req));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    try {
      const data = { ...req.body };
      if (req.file) data.coverImage = memoryFileUrl(req.file.filename);
      const album = await service.createAlbum({
        patientId: resolvePatientId(req),
        data,
        ctx: ctxFromReq(req),
      });
      res.status(201).json({ success: true, data: album });
    } catch (e) {
      next(e);
    }
  }

  async update(req, res, next) {
    try {
      const data = { ...req.body };
      if (req.file) data.coverImage = memoryFileUrl(req.file.filename);
      const album = await service.updateAlbum({ albumId: req.params.albumId, data, ctx: ctxFromReq(req) });
      res.json({ success: true, data: album });
    } catch (e) {
      next(e);
    }
  }

  async remove(req, res, next) {
    try {
      const result = await service.deleteAlbum({ albumId: req.params.albumId, ctx: ctxFromReq(req) });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async addItem(req, res, next) {
    try {
      const data = { ...req.body };
      const media = req.files?.media?.[0];
      const voice = req.files?.voiceNote?.[0];
      if (media) {
        data.mediaUrl = memoryFileUrl(media.filename);
        data.type = data.type || typeFromMime(media.mimetype);
      }
      if (voice) data.voiceNoteUrl = memoryFileUrl(voice.filename);
      const item = await service.addItem({ albumId: req.params.albumId, data, ctx: ctxFromReq(req) });
      res.status(201).json({ success: true, data: item });
    } catch (e) {
      next(e);
    }
  }

  async updateItem(req, res, next) {
    try {
      const data = { ...req.body };
      const media = req.files?.media?.[0];
      const voice = req.files?.voiceNote?.[0];
      if (media) {
        data.mediaUrl = memoryFileUrl(media.filename);
        data.type = data.type || typeFromMime(media.mimetype);
      }
      if (voice) data.voiceNoteUrl = memoryFileUrl(voice.filename);
      const item = await service.updateItem({ itemId: req.params.itemId, data, ctx: ctxFromReq(req) });
      res.json({ success: true, data: item });
    } catch (e) {
      next(e);
    }
  }

  async removeItem(req, res, next) {
    try {
      const result = await service.deleteItem({ itemId: req.params.itemId, ctx: ctxFromReq(req) });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async reorder(req, res, next) {
    try {
      const items = await service.reorderItems({
        albumId: req.params.albumId,
        order: req.body.order,
        ctx: ctxFromReq(req),
      });
      res.json({ success: true, data: items });
    } catch (e) {
      next(e);
    }
  }

  async logView(req, res, next) {
    try {
      const result = await service.logAlbumView(req.params.albumId, ctxFromReq(req));
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export default new MemoryAlbumController();
