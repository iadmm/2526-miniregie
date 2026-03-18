/**
 * Tests for schedule REST routes.
 *
 * Strategy: build an isolated Express app with mocked DB queries,
 * mocked auth middleware (always passes), and a mock BroadcastManager.
 * We test HTTP contracts only — not DB internals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { ScheduleEntry } from '../../../shared/types.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../db/queries.js', () => ({
  getScheduleEntries:     vi.fn(),
  insertScheduleEntry:    vi.fn(),
  updateScheduleEntry:    vi.fn(),
  deleteScheduleEntry:    vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth:  vi.fn((_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next()),
  requireRole:  vi.fn(() => (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next()),
}));

import {
  getScheduleEntries,
  insertScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
} from '../db/queries.js';

import createScheduleRouter from './schedule.js';
import type { BroadcastManager } from '../broadcast/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id:         1,
    at:         'H+00:10:00',
    app:        'jam-mode',
    label:      null,
    status:     'pending',
    firedAt:    null,
    createdAt:  1_000_000,
    modifiedAt: 1_000_000,
    ...overrides,
  };
}

function makeApp() {
  const mockBroadcast = {
    reloadSchedule: vi.fn(),
  } as unknown as BroadcastManager;

  const app = express();
  app.use(express.json());
  app.use('/api/schedule', createScheduleRouter(mockBroadcast));

  return { app, mockBroadcast };
}

// ─── GET /api/schedule ────────────────────────────────────────────────────────

describe('GET /api/schedule', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all schedule entries as JSON', async () => {
    const entries = [
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode' }),
      makeEntry({ id: 2, at: 'H+12:00:00', app: 'micro-trottoir', status: 'fired' }),
    ];
    vi.mocked(getScheduleEntries).mockReturnValue(entries);

    const { app } = makeApp();
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(entries);
  });

  it('returns an empty array when no entries', async () => {
    vi.mocked(getScheduleEntries).mockReturnValue([]);
    const { app } = makeApp();
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── POST /api/schedule ───────────────────────────────────────────────────────

describe('POST /api/schedule', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts entry and returns 201 with the new entry', async () => {
    const newEntry = makeEntry({ id: 3, at: 'T-04:00:00', app: 'micro-trottoir', label: 'Final session' });
    vi.mocked(insertScheduleEntry).mockReturnValue(newEntry);

    const { app, mockBroadcast } = makeApp();
    const res = await request(app)
      .post('/api/schedule')
      .send({ at: 'T-04:00:00', app: 'micro-trottoir', label: 'Final session' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(newEntry);
    expect(insertScheduleEntry).toHaveBeenCalledWith('T-04:00:00', 'micro-trottoir', 'Final session');
    expect(mockBroadcast.reloadSchedule).toHaveBeenCalledOnce();
  });

  it('inserts without label when not provided', async () => {
    const newEntry = makeEntry({ id: 4, at: 'H+24:00:00', app: 'jam-mode' });
    vi.mocked(insertScheduleEntry).mockReturnValue(newEntry);

    const { app } = makeApp();
    const res = await request(app)
      .post('/api/schedule')
      .send({ at: 'H+24:00:00', app: 'jam-mode' });

    expect(res.status).toBe(201);
    expect(insertScheduleEntry).toHaveBeenCalledWith('H+24:00:00', 'jam-mode', undefined);
  });

  it('returns 400 when at is missing', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/schedule').send({ app: 'jam-mode' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when app is missing', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/schedule').send({ at: 'H+00:10:00' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when at is an empty string', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/schedule').send({ at: '   ', app: 'jam-mode' });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/schedule/:id ────────────────────────────────────────────────────

describe('PUT /api/schedule/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates at field and reloads', async () => {
    vi.mocked(updateScheduleEntry).mockReturnValue(undefined);
    const { app, mockBroadcast } = makeApp();
    const res = await request(app).put('/api/schedule/1').send({ at: 'H+00:15:00' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(updateScheduleEntry).toHaveBeenCalledWith(1, { at: 'H+00:15:00' });
    expect(mockBroadcast.reloadSchedule).toHaveBeenCalledOnce();
  });

  it('updates app field', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/schedule/2').send({ app: 'micro-trottoir' });
    expect(res.status).toBe(200);
    expect(updateScheduleEntry).toHaveBeenCalledWith(2, { app: 'micro-trottoir' });
  });

  it('updates label to null (clearing)', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/schedule/1').send({ label: null });
    expect(res.status).toBe(200);
    expect(updateScheduleEntry).toHaveBeenCalledWith(1, { label: null });
  });

  it('updates status to skipped', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/schedule/1').send({ status: 'skipped' });
    expect(res.status).toBe(200);
    expect(updateScheduleEntry).toHaveBeenCalledWith(1, { status: 'skipped' });
  });

  it('returns 400 for invalid status', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/schedule/1').send({ status: 'bad_value' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when no fields to update', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/schedule/1').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is not a number', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/schedule/abc').send({ at: 'H+00:10:00' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/schedule/:id ─────────────────────────────────────────────────

describe('DELETE /api/schedule/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes entry and reloads', async () => {
    vi.mocked(deleteScheduleEntry).mockReturnValue(undefined);
    const { app, mockBroadcast } = makeApp();
    const res = await request(app).delete('/api/schedule/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(deleteScheduleEntry).toHaveBeenCalledWith(1);
    expect(mockBroadcast.reloadSchedule).toHaveBeenCalledOnce();
  });

  it('returns 400 when id is not a number', async () => {
    const { app } = makeApp();
    const res = await request(app).delete('/api/schedule/notanumber');
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/schedule/reload ────────────────────────────────────────────────

describe('POST /api/schedule/reload', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls reloadSchedule and returns ok', async () => {
    const { app, mockBroadcast } = makeApp();
    const res = await request(app).post('/api/schedule/reload');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockBroadcast.reloadSchedule).toHaveBeenCalledOnce();
  });
});
