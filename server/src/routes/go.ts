import { Router } from 'express';
import multer from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAuth, requireOnboarding, makeToken } from '../middleware/auth.js';
import { getTeams, setAvatarUrl, getAllItems } from '../db/queries.js';
import type { BroadcastManager } from '../broadcast/index.js';
import type { PoolManager } from '../pool/index.js';
import type { RawInput } from '../pool/types.js';

export default function createGoRouter(broadcast: BroadcastManager, pool: PoolManager): Router {
const router = Router();

// ─── Multer setup ─────────────────────────────────────────────────────────────

const UPLOAD_DIR  = process.env['UPLOAD_DIR'] ?? './uploads';

// ── Avatar upload (5 MiB, images only) ──────────────────────────────────────

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename(_req, file, cb) {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (AVATAR_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted'));
    }
  },
});

// ── Media submit upload (50 MiB, image/* + video/*) ─────────────────────────

const SUBMIT_MAX_BYTES = 50 * 1024 * 1024;

const submitUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename(_req, file, cb) {
      const ext = extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: SUBMIT_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * GET /go/api/teams
 * Returns distinct non-empty team names for autocomplete during registration.
 */
router.get('/teams', (_req, res) => {
  const teams = getTeams();
  res.json(teams);
});

// ─── Auth required ────────────────────────────────────────────────────────────

/**
 * GET /go/api/me
 * Returns the currently authenticated participant.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ participant: req.participant });
});

/**
 * GET /go/api/status
 * Returns jam status (stubbed) and the current participant's submitted items.
 */
router.get('/status', requireAuth, (req, res) => {
  const jamStatus = broadcast.getState().jam.status;

  const myItems = getAllItems({ authorId: req.participant!.id });

  res.json({ jamStatus, myItems });
});

// ─── Auth + onboarding required ───────────────────────────────────────────────

/**
 * POST /go/api/submit
 *
 * Accepts multipart/form-data. Required field: `type`.
 * - note:      `text` (string)
 * - link:      `url` (string)
 * - photo/gif: `file` (image file)
 * - clip:      `file` (video file)
 * - interview: `file[]` + optional `text[]` segments (future)
 *
 * Pipeline:
 * 1. Parse multipart body (multer)
 * 2. Build RawInput from fields + uploaded file
 * 3. Call pool.addItem(raw, participantId) — sanitize + guard + insert + async resolve
 * 4. Respond 201 { item } on success, or 422 / 429 / 403 on failure
 */
router.post(
  '/submit',
  requireAuth,
  requireOnboarding,
  submitUpload.single('file'),
  (req, res) => {
    const participant = req.participant!;

    // ── Build RawInput from parsed multipart fields ──────────────────────────

    const type = typeof req.body['type'] === 'string' ? req.body['type'] : undefined;

    let raw: RawInput;

    try {
      switch (type) {
        case 'note': {
          const text = req.body['text'];
          if (typeof text !== 'string') {
            res.status(422).json({ error: 'Field `text` is required for type note' });
            return;
          }
          raw = { type: 'note', text };
          break;
        }
        case 'ticker': {
          const text = req.body['text'];
          if (typeof text !== 'string' || !text.trim()) {
            res.status(422).json({ error: 'Field `text` is required for type ticker' });
            return;
          }
          raw = { type: 'ticker', text: text.trim() };
          break;
        }
        case 'photo': {
          if (!req.file) {
            res.status(422).json({ error: 'A file is required for type photo' });
            return;
          }
          raw = {
            type: 'photo',
            file: {
              originalname: req.file.originalname,
              mimetype:     req.file.mimetype,
              size:         req.file.size,
            },
            filePath: req.file.path,
          };
          break;
        }
        case 'gif': {
          if (!req.file) {
            res.status(422).json({ error: 'A file is required for type gif' });
            return;
          }
          raw = {
            type: 'gif',
            file: {
              originalname: req.file.originalname,
              mimetype:     req.file.mimetype,
              size:         req.file.size,
            },
            filePath: req.file.path,
          };
          break;
        }
        case 'clip': {
          if (!req.file) {
            res.status(422).json({ error: 'A file is required for type clip' });
            return;
          }
          raw = {
            type: 'clip',
            file: {
              originalname: req.file.originalname,
              mimetype:     req.file.mimetype,
              size:         req.file.size,
            },
            filePath: req.file.path,
          };
          break;
        }
        default:
          res.status(422).json({ error: `Unknown or missing submission type: ${String(type)}` });
          return;
      }
    } catch (err) {
      res.status(422).json({ error: String(err) });
      return;
    }

    // ── Run pipeline: sanitize → guard → insertItem → async resolve ──────────
    //
    // pool.addItem handles the entire pipeline synchronously (sanitize + guard +
    // DB insert) then kicks off async resolve in the background.  It throws on
    // sanitize/guard/quota errors — we map those to HTTP status codes here.

    let item: ReturnType<PoolManager['addItem']>;
    try {
      item = pool.addItem(raw, participant.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Rate-limit (guard)
      if (/too fast|wait 30s/i.test(message)) {
        res.status(429).json({ error: message });
        return;
      }

      // JAM not running (guard)
      if (/not started yet|jam is over/i.test(message)) {
        res.status(403).json({ error: message });
        return;
      }

      // Clip quota (pool guard)
      if (/clip quota/i.test(message)) {
        res.status(429).json({ error: message });
        return;
      }

      // Sanitize error (invalid MIME, size, text, URL…)
      res.status(422).json({ error: message });
      return;
    }

    res.status(201).json({ item });
  },
);

// ─── Onboarding ───────────────────────────────────────────────────────────────

/**
 * POST /go/api/onboarding/avatar
 * Uploads a profile photo and stores the URL on the participant record.
 * After this call the participant passes requireOnboarding.
 */
router.post(
  '/onboarding/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No avatar file uploaded' });
      return;
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const p = req.participant!;
    setAvatarUrl(p.id, avatarUrl);

    const token = await makeToken(p.id, p.displayName, p.role, avatarUrl);
    res.json({ token });
  },
);

return router;
}
