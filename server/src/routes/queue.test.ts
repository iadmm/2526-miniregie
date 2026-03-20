/**
 * Tests for queue REST routes:
 *   GET  /api/queue/main
 *   GET  /api/queue/played
 *   POST /api/queue/reorder
 *   POST /api/queue/:id/replay
 *
 * Strategy: isolated Express app with mocked auth and a pool stub.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { MediaItem } from '../../../shared/types.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next()),
  requireRole: vi.fn(() => (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next()),
}));

import createQueueRouter from './queue.js';
import type { PoolManager } from '../pool/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<MediaItem> & { id?: string } = {}): MediaItem {
  return {
    id:            overrides.id ?? 'item-1',
    type:          overrides.type ?? 'photo',
    content:       { url: '/uploads/foo.jpg', caption: null },
    queuePosition: overrides.queuePosition ?? null,
    status:        overrides.status ?? 'ready',
    submittedAt:   1000,
    author: { participantId: 'p1', displayName: 'Alice', team: 'A', role: 'participant' },
    ...overrides,
  };
}

function makePool(overrides: Partial<PoolManager> = {}): PoolManager {
  return {
    getMain:   vi.fn().mockReturnValue([]),
    getPlayed: vi.fn().mockReturnValue([]),
    reorder:   vi.fn(),
    replay:    vi.fn(),
    ...overrides,
  } as unknown as PoolManager;
}

function makeApp(pool: PoolManager) {
  const app = express();
  app.use(express.json());
  app.use('/api/queue', createQueueRouter(pool));
  return app;
}

// ─── GET /api/queue/main ──────────────────────────────────────────────────────

describe('GET /api/queue/main', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 with getMain() result', async () => {
    const items = [makeItem({ id: 'a', queuePosition: 1 })];
    const pool = makePool({ getMain: vi.fn().mockReturnValue(items) });

    const res = await request(makeApp(pool)).get('/api/queue/main');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(items);
  });

  it('passes types query param as array to getMain', async () => {
    const pool = makePool();
    await request(makeApp(pool)).get('/api/queue/main?types=photo,note');
    expect(pool.getMain).toHaveBeenCalledWith(
      expect.objectContaining({ types: ['photo', 'note'] }),
    );
  });

  it('passes excludeTypes query param as array to getMain', async () => {
    const pool = makePool();
    await request(makeApp(pool)).get('/api/queue/main?excludeTypes=ticker');
    expect(pool.getMain).toHaveBeenCalledWith(
      expect.objectContaining({ excludeTypes: ['ticker'] }),
    );
  });

  it('calls getMain with no filters when no query params', async () => {
    const pool = makePool();
    await request(makeApp(pool)).get('/api/queue/main');
    expect(pool.getMain).toHaveBeenCalledWith({});
  });
});

// ─── GET /api/queue/played ────────────────────────────────────────────────────

describe('GET /api/queue/played', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 with getPlayed() result', async () => {
    const items = [makeItem({ id: 'p1', status: 'played' })];
    const pool = makePool({ getPlayed: vi.fn().mockReturnValue(items) });

    const res = await request(makeApp(pool)).get('/api/queue/played');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(items);
  });

  it('passes types query param to getPlayed', async () => {
    const pool = makePool();
    await request(makeApp(pool)).get('/api/queue/played?types=photo,clip');
    expect(pool.getPlayed).toHaveBeenCalledWith(
      expect.objectContaining({ types: ['photo', 'clip'] }),
    );
  });

  it('calls getPlayed with no filters when no query params', async () => {
    const pool = makePool();
    await request(makeApp(pool)).get('/api/queue/played');
    expect(pool.getPlayed).toHaveBeenCalledWith({});
  });
});

// ─── POST /api/queue/reorder ─────────────────────────────────────────────────

describe('POST /api/queue/reorder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 { ok: true } on success', async () => {
    const pool = makePool();
    const res = await request(makeApp(pool))
      .post('/api/queue/reorder')
      .send({ ids: ['a', 'b', 'c'] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(pool.reorder).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('returns 400 when ids is missing', async () => {
    const pool = makePool();
    const res = await request(makeApp(pool))
      .post('/api/queue/reorder')
      .send({});
    expect(res.status).toBe(400);
    expect(pool.reorder).not.toHaveBeenCalled();
  });

  it('returns 400 when ids is not an array', async () => {
    const pool = makePool();
    const res = await request(makeApp(pool))
      .post('/api/queue/reorder')
      .send({ ids: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(pool.reorder).not.toHaveBeenCalled();
  });

  it('returns 400 when ids contains non-string elements', async () => {
    const pool = makePool();
    const res = await request(makeApp(pool))
      .post('/api/queue/reorder')
      .send({ ids: [1, 2, 3] });
    expect(res.status).toBe(400);
    expect(pool.reorder).not.toHaveBeenCalled();
  });

  it('returns 400 when pool.reorder throws (ids mismatch)', async () => {
    const pool = makePool({
      reorder: vi.fn().mockImplementation(() => { throw new Error('ids mismatch'); }),
    });
    const res = await request(makeApp(pool))
      .post('/api/queue/reorder')
      .send({ ids: ['a', 'b'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

// ─── POST /api/queue/:id/replay ───────────────────────────────────────────────

describe('POST /api/queue/:id/replay', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 { ok: true } on success', async () => {
    const pool = makePool();
    const res = await request(makeApp(pool))
      .post('/api/queue/item-x/replay');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(pool.replay).toHaveBeenCalledWith('item-x');
  });

  it('returns 404 when pool.replay throws "not found"', async () => {
    const pool = makePool({
      replay: vi.fn().mockImplementation(() => { throw new Error('Item x not found'); }),
    });
    const res = await request(makeApp(pool)).post('/api/queue/x/replay');
    expect(res.status).toBe(404);
  });

  it('returns 400 when pool.replay throws "not played"', async () => {
    const pool = makePool({
      replay: vi.fn().mockImplementation(() => { throw new Error('Item x is not played'); }),
    });
    const res = await request(makeApp(pool)).post('/api/queue/x/replay');
    expect(res.status).toBe(400);
  });
});
