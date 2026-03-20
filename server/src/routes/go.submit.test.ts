/**
 * Tests for POST /go/api/submit
 *
 * Strategy: build an isolated Express app that mounts the go router with mocked
 * dependencies. Multer disk storage is replaced with memory storage so no real
 * files are written.  DB queries and pool.addItem are vi.mock'd.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Participant } from '../../../shared/types.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the DB queries used by the route
vi.mock('../db/queries.js', () => ({
  getTeams:            vi.fn().mockReturnValue([]),
  setAvatarUrl:        vi.fn(),
  getAllItems:          vi.fn().mockReturnValue([]),
  insertItem:          vi.fn(),
  getLastSubmissionAt: vi.fn().mockReturnValue(null),
  getClipCount:        vi.fn().mockReturnValue(0),
}));

// Mock the auth middleware — replaced per test via module augmentation
vi.mock('../middleware/auth.js', () => ({
  requireAuth:        vi.fn((_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next()),
  requireOnboarding:  vi.fn((_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next()),
}));

// We do NOT mock the pool module itself; we pass a mock pool instance.

import { getLastSubmissionAt, getClipCount } from '../db/queries.js';
import { requireAuth, requireOnboarding } from '../middleware/auth.js';
import createGoRouter from './go.js';
import type { BroadcastManager } from '../broadcast/index.js';
import type { PoolManager } from '../pool/index.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

/** A fully-onboarded participant fixture */
const fakeParticipant: Participant = {
  id:          'participant-abc',
  username:    'tester',
  displayName: 'Test User',
  team:        'Team A',
  role:        'participant',
  avatarUrl:   '/uploads/avatar.jpg', // has avatar → passes requireOnboarding
  firstSeenAt: 1_000_000,
  lastSeenAt:  1_000_000,
  banned:      false,
  bannedAt:    null,
  banReason:   null,
};

/** Minimal BroadcastManager stub */
function makeBroadcast(jamStatus: 'idle' | 'running' | 'ended' = 'running'): BroadcastManager {
  return {
    getState: () => ({
      jam:       { status: jamStatus, startedAt: null, endsAt: null, timeRemaining: null },
      broadcast: { activeApp: 'jam-mode', transition: 'idle', panicState: false },
      pool:      { total: 0, fresh: 0, queueSnapshot: [] },
    }),
  } as unknown as BroadcastManager;
}

/**
 * Creates a pool mock.  addItem is the key method under test — by default it
 * returns a fake MediaItem (simulating a successful submission).
 */
function makePool(overrides: Partial<{ addItem: PoolManager['addItem'] }> = {}): PoolManager {
  const defaultAddItem: PoolManager['addItem'] = (_raw, _participantId) => ({
    id:            'item-123',
    type:          'note',
    content:       { text: 'hello' },
    queuePosition: null,
    status:        'pending',
    submittedAt:   Date.now(),
    author: {
      participantId: fakeParticipant.id,
      displayName:   fakeParticipant.displayName,
      team:          fakeParticipant.team,
      role:          fakeParticipant.role,
    },
  });
  return {
    addItem: overrides.addItem ?? defaultAddItem,
  } as unknown as PoolManager;
}

/**
 * Injects `fakeParticipant` into `req.participant` so that requireAuth is
 * effectively a pass-through AND the route can read req.participant.
 */
function injectParticipant(participant: Participant = fakeParticipant) {
  vi.mocked(requireAuth).mockImplementation((req, _res, next) => {
    req.participant = participant;
    next();
  });
  vi.mocked(requireOnboarding).mockImplementation((_req, _res, next) => next());
}

function buildApp(
  broadcast: BroadcastManager = makeBroadcast(),
  pool: PoolManager = makePool(),
): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/go/api', createGoRouter(broadcast, pool));
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /go/api/submit', () => {
  beforeEach(() => {
    vi.mocked(getLastSubmissionAt).mockReturnValue(null);
    vi.mocked(getClipCount).mockReturnValue(0);
    injectParticipant();
  });

  // ── 1. Ticker → 201 ────────────────────────────────────────────────────────

  it('201 — ticker submission returns item', async () => {
    const pool = makePool({
      addItem: (_raw, _participantId) => ({
        id:            'item-ticker',
        type:          'note',
        content:       { text: 'Hello from ticker' },
        queuePosition: null,
        status:        'pending',
        submittedAt:   Date.now(),
        author: {
          participantId: fakeParticipant.id,
          displayName:   fakeParticipant.displayName,
          team:          fakeParticipant.team,
          role:          fakeParticipant.role,
        },
      }),
    });
    const app = buildApp(makeBroadcast(), pool);

    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'note')
      .field('text', 'Hello from ticker');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('item');
    expect(res.body.item).toHaveProperty('id');
  });

  // ── 2. Photo → 201 ─────────────────────────────────────────────────────────

  it('201 — photo submission returns item', async () => {
    const pool = makePool({
      addItem: (_raw, _participantId) => ({
        id:            'item-photo',
        type:          'photo',
        content:       { url: '/uploads/photo.jpg', caption: null },
        queuePosition: null,
        status:        'pending',
        submittedAt:   Date.now(),
        author: {
          participantId: fakeParticipant.id,
          displayName:   fakeParticipant.displayName,
          team:          fakeParticipant.team,
          role:          fakeParticipant.role,
        },
      }),
    });
    const app = buildApp(makeBroadcast(), pool);

    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'photo')
      .attach('file', Buffer.from('fake-jpeg-data'), {
        filename:    'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('item');
    expect(res.body.item.type).toBe('photo');
  });

  // ── 3. Clip → 201 ──────────────────────────────────────────────────────────

  it('201 — clip submission returns item', async () => {
    const pool = makePool({
      addItem: (_raw, _participantId) => ({
        id:            'item-clip',
        type:          'clip',
        content:       { url: '/uploads/clip.mp4', duration: 0, mimeType: 'video/mp4', caption: null },
        queuePosition: null,
        status:        'pending',
        submittedAt:   Date.now(),
        author: {
          participantId: fakeParticipant.id,
          displayName:   fakeParticipant.displayName,
          team:          fakeParticipant.team,
          role:          fakeParticipant.role,
        },
      }),
    });
    const app = buildApp(makeBroadcast(), pool);

    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'clip')
      .attach('file', Buffer.from('fake-mp4-data'), {
        filename:    'clip.mp4',
        contentType: 'video/mp4',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('item');
    expect(res.body.item.type).toBe('clip');
  });

  // ── 4. Sanitize failure → 422 ──────────────────────────────────────────────

  it('422 — pool.addItem throws sanitize error (oversized file)', async () => {
    const pool = makePool({
      addItem: () => { throw new Error('File size 104857601 exceeds limit of 52428800 bytes'); },
    });
    const app = buildApp(makeBroadcast(), pool);

    // Send a file that pool.addItem will reject
    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'clip')
      .attach('file', Buffer.alloc(100), {
        filename:    'clip.mp4',
        contentType: 'video/mp4',
      });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
  });

  // ── 5. Guard rate-limit → 429 ──────────────────────────────────────────────

  it('429 — pool.addItem throws rate-limit error', async () => {
    const pool = makePool({
      addItem: () => { throw new Error('Too fast — wait 30s between submissions'); },
    });
    const app = buildApp(makeBroadcast(), pool);

    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'note')
      .field('text', 'hello');

    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error');
  });

  // ── 6. Missing auth → 401 ──────────────────────────────────────────────────

  it('401 — no auth returns 401', async () => {
    // Override requireAuth to behave like the real middleware (unauthenticated)
    vi.mocked(requireAuth).mockImplementation((_req, res, _next) => {
      res.status(401).json({ error: 'Authentication required' });
    });

    const app = buildApp();

    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'note')
      .field('text', 'hello');

    expect(res.status).toBe(401);
  });

  // ── 7. Guard JAM-not-started → 403 ─────────────────────────────────────────

  it('403 — pool.addItem throws JAM-idle error', async () => {
    const pool = makePool({
      addItem: () => { throw new Error('JAM not started yet'); },
    });
    const app = buildApp(makeBroadcast('idle'), pool);

    const res = await request(app)
      .post('/go/api/submit')
      .field('type', 'note')
      .field('text', 'hello');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});