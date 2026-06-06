import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Memory media upload middleware.
 *
 * Handles the richer media needs of the Memory Assistant System — images,
 * videos, and audio (voice notes) — which the image-only upload.middleware
 * does not support. Files land in /uploads/memory and are served statically
 * by the existing `app.use('/uploads', express.static(...))` mount.
 */
const MEMORY_DIR = path.join(__dirname, '..', 'uploads', 'memory');
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEMORY_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const EXT = {
  image: /\.(jpe?g|png|gif|webp|bmp)$/i,
  video: /\.(mp4|webm|ogg|ogv|mov|m4v)$/i,
  audio: /\.(mp3|wav|webm|ogg|oga|m4a|aac|3gp)$/i,
};

const mediaFilter = (req, file, cb) => {
  const mt = (file.mimetype || '').toLowerCase();
  const name = file.originalname || '';
  const ok =
    mt.startsWith('image/') ||
    mt.startsWith('video/') ||
    mt.startsWith('audio/') ||
    EXT.image.test(name) ||
    EXT.video.test(name) ||
    EXT.audio.test(name);

  if (ok) return cb(null, true);
  cb(new Error('Only image, video, or audio files are allowed'), false);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB — accommodates short videos
    files: 2,
  },
  fileFilter: mediaFilter,
});

/** Wrap a multer handler with consistent JSON error responses. */
const wrap = (handler) => (req, res, next) => {
  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size cannot exceed 50MB' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

/** Single album cover image. */
export const uploadAlbumCover = wrap(upload.single('coverImage'));

/** A memory item's main media file plus an optional voice note. */
export const uploadMemoryMedia = wrap(
  upload.fields([
    { name: 'media', maxCount: 1 },
    { name: 'voiceNote', maxCount: 1 },
  ])
);

/** Build the public URL for an uploaded memory file. */
export const memoryFileUrl = (filename) => (filename ? `/uploads/memory/${filename}` : null);

/** Best-effort delete of a previously uploaded memory file (by public URL). */
export const deleteMemoryFile = (publicUrl) => {
  try {
    if (!publicUrl) return false;
    const filename = publicUrl.split('/').pop();
    const full = path.join(MEMORY_DIR, filename);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[uploadMedia] delete failed:', err.message);
    return false;
  }
};

export default { uploadAlbumCover, uploadMemoryMedia, memoryFileUrl, deleteMemoryFile };
