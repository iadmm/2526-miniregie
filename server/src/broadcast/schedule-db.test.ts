/**
 * Tests verifying that BroadcastManager loads its schedule from DB and
 * marks entries as fired in DB when triggers execute.
 *
 * Strategy: mock all DB query functions so no real DB is touched.
 * We test the integration contract between BroadcastManager and the DB layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScheduleEntry } from "@shared/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../db/queries.js', () => ({
  getScheduleEntries:      vi.fn(),
  markScheduleEntryFired:  vi.fn(),
  resetScheduleStatus:     vi.fn(),
  insertBroadcastEvent:    vi.fn(),
  resetAllMedia:           vi.fn(),
}));

vi.mock('../db/index.js', () => ({}));

vi.mock('../jam-config.js', () => ({
  getJamConfig: () => ({
    jam:       { startAt: '2026-03-01T09:00:00.000Z', endsAt: '2026-03-03T09:00:00.000Z', countdownDurationMs: 600_000 },
    broadcast: { transitionFailsafeMs: 3_000, statePersistIntervalMs: 30_000, postJamIdleDelayMs: 300_000 },
    pool:      { itemCooldownMs: 300_000, authorDisplayCooldownMs: 120_000, clipQuotaPerParticipant: 3, freshItemWindowMs: 120_000 },
    client:    { watchdogTimeoutMs: 30_000 },
  }),
}));

import { getScheduleEntries, markScheduleEntryFired, resetScheduleStatus } from '../db/queries.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MIN  = 60_000;
const HOUR = 60 * MIN;

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

// ─── loadSchedule — reads from DB ─────────────────────────────────────────────

describe('BroadcastManager — loadSchedule reads from DB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getScheduleEntries() on construction', async () => {
    vi.mocked(getScheduleEntries).mockReturnValue([]);

    const { BroadcastManager } = await import('./index.js');
    const mockIo = {
      emit: vi.fn(),
      on:   vi.fn(),
    } as unknown as import('socket.io').Server;

    const mockPool = {
      getStats:    vi.fn().mockReturnValue({ total: 0, fresh: 0, queueSnapshot: [] }),
      on:          vi.fn(),
      reset:       vi.fn(),
      getJamState: vi.fn(),
    } as unknown as import('../pool/index.js').PoolManager;

    new BroadcastManager({ io: mockIo, pool: mockPool });

    expect(getScheduleEntries).toHaveBeenCalled();
  });

  it('skips entries that cannot be parsed by parseScheduleEntry', async () => {
    vi.mocked(getScheduleEntries).mockReturnValue([
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode' }),
      makeEntry({ id: 2, at: 'INVALID_FORMAT', app: 'micro-trottoir' }),
    ]);

    const { BroadcastManager } = await import('./index.js');
    const mockIo = { emit: vi.fn(), on: vi.fn() } as unknown as import('socket.io').Server;
    const mockPool = {
      getStats: vi.fn().mockReturnValue({ total: 0, fresh: 0, queueSnapshot: [] }),
      on:       vi.fn(),
      reset:    vi.fn(),
    } as unknown as import('../pool/index.js').PoolManager;

    const bm = new BroadcastManager({ io: mockIo, pool: mockPool });
    // Only the valid entry should appear in the schedule
    expect(bm.getSchedule()).toHaveLength(1);
    expect(bm.getSchedule()[0]!.appId).toBe('jam-mode');
  });

  it('skips entries with status=fired on load (already fired)', async () => {
    vi.mocked(getScheduleEntries).mockReturnValue([
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode', status: 'fired', firedAt: 1_000_000 }),
      makeEntry({ id: 2, at: 'H+12:00:00', app: 'micro-trottoir', status: 'pending' }),
    ]);

    const { BroadcastManager } = await import('./index.js');
    const mockIo = { emit: vi.fn(), on: vi.fn() } as unknown as import('socket.io').Server;
    const mockPool = {
      getStats: vi.fn().mockReturnValue({ total: 0, fresh: 0, queueSnapshot: [] }),
      on:       vi.fn(),
      reset:    vi.fn(),
    } as unknown as import('../pool/index.js').PoolManager;

    const bm = new BroadcastManager({ io: mockIo, pool: mockPool });
    // Fired entry should not be re-scheduled
    expect(bm.getSchedule()).toHaveLength(1);
    expect(bm.getSchedule()[0]!.appId).toBe('micro-trottoir');
  });
});

// ─── reloadSchedule ───────────────────────────────────────────────────────────

describe('BroadcastManager — reloadSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-reads DB and updates schedule', async () => {
    // Initially one entry
    vi.mocked(getScheduleEntries).mockReturnValueOnce([
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode' }),
    ]);
    // After reload, two entries
    vi.mocked(getScheduleEntries).mockReturnValueOnce([
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode' }),
      makeEntry({ id: 2, at: 'H+12:00:00', app: 'micro-trottoir' }),
    ]);

    const { BroadcastManager } = await import('./index.js');
    const mockIo = { emit: vi.fn(), on: vi.fn() } as unknown as import('socket.io').Server;
    const mockPool = {
      getStats: vi.fn().mockReturnValue({ total: 0, fresh: 0, queueSnapshot: [] }),
      on:       vi.fn(),
      reset:    vi.fn(),
    } as unknown as import('../pool/index.js').PoolManager;

    const bm = new BroadcastManager({ io: mockIo, pool: mockPool });
    expect(bm.getSchedule()).toHaveLength(1);

    bm.reloadSchedule();
    expect(bm.getSchedule()).toHaveLength(2);
    expect(getScheduleEntries).toHaveBeenCalledTimes(2);
  });
});

// ─── reset() calls resetScheduleStatus ───────────────────────────────────────

describe('BroadcastManager — reset() calls resetScheduleStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls resetScheduleStatus() and reloads from DB', async () => {
    vi.mocked(getScheduleEntries).mockReturnValue([
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode' }),
    ]);

    const { BroadcastManager } = await import('./index.js');
    const mockIo = { emit: vi.fn(), on: vi.fn() } as unknown as import('socket.io').Server;
    const mockPool = {
      getStats: vi.fn().mockReturnValue({ total: 0, fresh: 0, queueSnapshot: [] }),
      on:       vi.fn(),
      reset:    vi.fn(),
    } as unknown as import('../pool/index.js').PoolManager;

    const bm = new BroadcastManager({ io: mockIo, pool: mockPool });
    vi.clearAllMocks();
    vi.mocked(getScheduleEntries).mockReturnValue([
      makeEntry({ id: 1, at: 'H+00:10:00', app: 'jam-mode' }),
    ]);

    bm.reset();

    expect(resetScheduleStatus).toHaveBeenCalledOnce();
    expect(getScheduleEntries).toHaveBeenCalledOnce();
  });
});

// ─── tick() calls markScheduleEntryFired when trigger fires ──────────────────

describe('BroadcastManager — tick() marks DB entry as fired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls markScheduleEntryFired with the correct dbId when a trigger fires', async () => {
    const JAM_START = 1_000_000;
    const TRIGGER_OFFSET = 10 * MIN;

    vi.mocked(getScheduleEntries).mockReturnValue([
      makeEntry({ id: 42, at: 'H+00:10:00', app: 'jam-mode', status: 'pending' }),
    ]);

    const { BroadcastManager } = await import('./index.js');
    const mockIo = { emit: vi.fn(), on: vi.fn() } as unknown as import('socket.io').Server;
    const mockPool = {
      getStats: vi.fn().mockReturnValue({ total: 0, fresh: 0, queueSnapshot: [] }),
      on:       vi.fn(),
      reset:    vi.fn(),
    } as unknown as import('../pool/index.js').PoolManager;

    const bm = new BroadcastManager({ io: mockIo, pool: mockPool });

    // Put JAM into running state
    bm['state'].jam = {
      status:        'running',
      startedAt:     JAM_START,
      endsAt:        JAM_START + 48 * HOUR,
      timeRemaining: 48 * HOUR,
    };

    // Simulate tick at the exact trigger time — trigger should fire
    vi.spyOn(Date, 'now').mockReturnValue(JAM_START + TRIGGER_OFFSET);
    bm['tick']();
    vi.restoreAllMocks();

    expect(markScheduleEntryFired).toHaveBeenCalledWith(42, expect.any(Number));
  });
});
