/**
 * Tests for PoolManager session-2 methods:
 * getMain, getPlayed, getItems (updated), reorder, replay, enrich-link-dedup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaItem } from '@shared/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../db/index.js', () => ({}));

vi.mock('../jam-config.js', () => ({
  getJamConfig: () => ({
    jam:       { startAt: '2026-01-01T09:00:00.000Z', endsAt: '2026-01-03T09:00:00.000Z', countdownDurationMs: 600_000 },
    broadcast: { transitionFailsafeMs: 3_000, statePersistIntervalMs: 30_000, postJamIdleDelayMs: 300_000 },
    pool:      { clipQuotaPerParticipant: 3 },
    client:    { watchdogTimeoutMs: 30_000 },
  }),
}));

const mockGetReadyItems          = vi.fn();
const mockGetPlayedItems         = vi.fn();
const mockGetItemById            = vi.fn();
const mockInsertItem             = vi.fn();
const mockUpdateStatus           = vi.fn();
const mockUpdateContent          = vi.fn();
const mockUpdateQueuePosition    = vi.fn();
const mockUpdateSubmittedAt      = vi.fn();
const mockInsertEvent            = vi.fn();
const mockGetLastSubmissionAt    = vi.fn().mockReturnValue(null);
const mockGetClipCount           = vi.fn().mockReturnValue(0);
const mockGetMaxQueuePosition    = vi.fn().mockReturnValue(null);
const mockBatchUpdateQueuePositions = vi.fn();

vi.mock('../db/queries.js', () => ({
  getReadyItems:              (...args: unknown[]) => mockGetReadyItems(...args),
  getPlayedItems:             (...args: unknown[]) => mockGetPlayedItems(...args),
  getItemById:                (...args: unknown[]) => mockGetItemById(...args),
  insertItem:                 (...args: unknown[]) => mockInsertItem(...args),
  updateStatus:               (...args: unknown[]) => mockUpdateStatus(...args),
  updateContent:              (...args: unknown[]) => mockUpdateContent(...args),
  updateQueuePosition:        (...args: unknown[]) => mockUpdateQueuePosition(...args),
  updateSubmittedAt:          (...args: unknown[]) => mockUpdateSubmittedAt(...args),
  insertEvent:                (...args: unknown[]) => mockInsertEvent(...args),
  getLastSubmissionAt:        (...args: unknown[]) => mockGetLastSubmissionAt(...args),
  getClipCount:               (...args: unknown[]) => mockGetClipCount(...args),
  getMaxQueuePosition:        (...args: unknown[]) => mockGetMaxQueuePosition(...args),
  batchUpdateQueuePositions:  (...args: unknown[]) => mockBatchUpdateQueuePositions(...args),
}));

const mockSanitize = vi.fn();
vi.mock('./sanitize.js', () => ({ sanitize: (...args: unknown[]) => mockSanitize(...args) }));

const mockResolve = vi.fn();
vi.mock('./resolve.js', () => ({ resolve: (...args: unknown[]) => mockResolve(...args) }));

import { PoolManager } from './index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<MediaItem> & { id?: string } = {}): MediaItem {
  return {
    id:            overrides.id ?? 'item-1',
    type:          overrides.type ?? 'photo',
    content:       overrides.content ?? { url: '/uploads/foo.jpg', caption: null },
    queuePosition: overrides.queuePosition ?? null,
    status:        overrides.status ?? 'ready',
    submittedAt:   overrides.submittedAt ?? 1000,
    author: {
      participantId: 'p1',
      displayName:   'Alice',
      team:          'A',
      role:          'participant',
    },
    ...overrides,
  };
}

function makePool() {
  return new PoolManager({
    getJamState: () => ({ status: 'running', startedAt: 1000, endsAt: 9_999_999, timeRemaining: null }),
  });
}

// ─── getMain ──────────────────────────────────────────────────────────────────

describe('PoolManager — getMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReadyItems.mockReturnValue([]);
    mockGetPlayedItems.mockReturnValue([]);
  });

  it('queries with positionedOnly:true', () => {
    const pool = makePool();
    pool.getMain();
    expect(mockGetReadyItems).toHaveBeenCalledWith(expect.objectContaining({ positionedOnly: true }));
  });

  it('returns items sorted by queuePosition ASC', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([
      makeItem({ id: 'b', queuePosition: 2 }),
      makeItem({ id: 'a', queuePosition: 1 }),
      makeItem({ id: 'c', queuePosition: 3 }),
    ]);
    const result = pool.getMain();
    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('passes types filter', () => {
    const pool = makePool();
    pool.getMain({ types: ['photo'] });
    expect(mockGetReadyItems).toHaveBeenCalledWith(expect.objectContaining({ types: ['photo'], positionedOnly: true }));
  });

  it('passes excludeTypes filter', () => {
    const pool = makePool();
    pool.getMain({ excludeTypes: ['ticker'] });
    expect(mockGetReadyItems).toHaveBeenCalledWith(expect.objectContaining({ excludeTypes: ['ticker'], positionedOnly: true }));
  });
});

// ─── getPlayed ────────────────────────────────────────────────────────────────

describe('PoolManager — getPlayed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayedItems.mockReturnValue([]);
  });

  it('returns all played items', () => {
    const pool = makePool();
    const played = [
      makeItem({ id: 'p1', status: 'played' }),
      makeItem({ id: 'p2', status: 'played' }),
    ];
    mockGetPlayedItems.mockReturnValue(played);
    expect(pool.getPlayed()).toEqual(played);
  });

  it('filters by types when provided', () => {
    const pool = makePool();
    mockGetPlayedItems.mockReturnValue([
      makeItem({ id: 'p1', type: 'photo', status: 'played' }),
      makeItem({ id: 'p2', type: 'note',  status: 'played' }),
    ]);
    const result = pool.getPlayed({ types: ['photo'] });
    expect(result.map(i => i.id)).toEqual(['p1']);
  });
});

// ─── getItems (union) ─────────────────────────────────────────────────────────

describe('PoolManager — getItems (union ready + played)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReadyItems.mockReturnValue([]);
    mockGetPlayedItems.mockReturnValue([]);
  });

  it('returns union of ready and played items', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([makeItem({ id: 'r1', status: 'ready',  submittedAt: 1000 })]);
    mockGetPlayedItems.mockReturnValue([makeItem({ id: 'p1', status: 'played', submittedAt: 2000 })]);
    const result = pool.getItems();
    expect(result.map(i => i.id)).toEqual(expect.arrayContaining(['r1', 'p1']));
    expect(result).toHaveLength(2);
  });

  it('sorts by submittedAt ASC by default', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([makeItem({ id: 'r1', submittedAt: 2000 })]);
    mockGetPlayedItems.mockReturnValue([makeItem({ id: 'p1', submittedAt: 1000 })]);
    const result = pool.getItems();
    expect(result.map(i => i.id)).toEqual(['p1', 'r1']);
  });

  it('sorts by submittedAt DESC when requested', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([makeItem({ id: 'r1', submittedAt: 2000 })]);
    mockGetPlayedItems.mockReturnValue([makeItem({ id: 'p1', submittedAt: 1000 })]);
    const result = pool.getItems({ sort: 'submittedAt DESC' });
    expect(result.map(i => i.id)).toEqual(['r1', 'p1']);
  });

  it('filters by types across both sets', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([
      makeItem({ id: 'r-photo', type: 'photo', submittedAt: 1000 }),
      makeItem({ id: 'r-note',  type: 'note',  submittedAt: 2000 }),
    ]);
    mockGetPlayedItems.mockReturnValue([
      makeItem({ id: 'p-photo', type: 'photo', status: 'played', submittedAt: 3000 }),
    ]);
    const result = pool.getItems({ types: ['photo'] });
    expect(result.map(i => i.id)).toEqual(['r-photo', 'p-photo']);
  });

  it('filters by submittedAfter', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([
      makeItem({ id: 'old', submittedAt: 500  }),
      makeItem({ id: 'new', submittedAt: 2000 }),
    ]);
    mockGetPlayedItems.mockReturnValue([
      makeItem({ id: 'old-played', status: 'played', submittedAt: 300 }),
    ]);
    const result = pool.getItems({ submittedAfter: 1000 });
    expect(result.map(i => i.id)).toEqual(['new']);
  });
});

// ─── reorder ──────────────────────────────────────────────────────────────────

describe('PoolManager — reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayedItems.mockReturnValue([]);
  });

  it('assigns sequential queue positions in given order', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([
      makeItem({ id: 'a', queuePosition: 1 }),
      makeItem({ id: 'b', queuePosition: 2 }),
      makeItem({ id: 'c', queuePosition: 3 }),
    ]);
    pool.reorder(['c', 'a', 'b']);
    expect(mockBatchUpdateQueuePositions).toHaveBeenCalledWith([
      { id: 'c', queuePosition: 1 },
      { id: 'a', queuePosition: 2 },
      { id: 'b', queuePosition: 3 },
    ]);
  });

  it('throws if ids contain an extra id not in queue.main', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([makeItem({ id: 'a', queuePosition: 1 })]);
    expect(() => pool.reorder(['a', 'b'])).toThrow();
  });

  it('throws if ids are missing an id from queue.main', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([
      makeItem({ id: 'a', queuePosition: 1 }),
      makeItem({ id: 'b', queuePosition: 2 }),
    ]);
    expect(() => pool.reorder(['a'])).toThrow();
  });

  it('emits update', () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([makeItem({ id: 'a', queuePosition: 1 })]);
    const spy = vi.fn();
    pool.on('update', spy);
    pool.reorder(['a']);
    expect(spy).toHaveBeenCalled();
  });
});

// ─── replay ───────────────────────────────────────────────────────────────────

describe('PoolManager — replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReadyItems.mockReturnValue([]);
    mockGetPlayedItems.mockReturnValue([]);
  });

  it('assigns end position (MAX + 1) and sets status ready', () => {
    const pool = makePool();
    mockGetItemById.mockReturnValue(makeItem({ id: 'x', status: 'played' }));
    mockGetMaxQueuePosition.mockReturnValue(5);
    pool.replay('x');
    expect(mockUpdateQueuePosition).toHaveBeenCalledWith('x', 6);
    expect(mockUpdateStatus).toHaveBeenCalledWith('x', 'ready');
  });

  it('assigns position 1 when queue.main is empty (MAX = null)', () => {
    const pool = makePool();
    mockGetItemById.mockReturnValue(makeItem({ id: 'x', status: 'played' }));
    mockGetMaxQueuePosition.mockReturnValue(null);
    pool.replay('x');
    expect(mockUpdateQueuePosition).toHaveBeenCalledWith('x', 1);
  });

  it('inserts a replayed media event', () => {
    const pool = makePool();
    mockGetItemById.mockReturnValue(makeItem({ id: 'x', status: 'played' }));
    mockGetMaxQueuePosition.mockReturnValue(0);
    pool.replay('x');
    expect(mockInsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'x', type: 'replayed' }),
    );
  });

  it('throws if item is not found', () => {
    const pool = makePool();
    mockGetItemById.mockReturnValue(null);
    expect(() => pool.replay('x')).toThrow(/not found/i);
  });

  it('throws if item is not played', () => {
    const pool = makePool();
    mockGetItemById.mockReturnValue(makeItem({ id: 'x', status: 'ready' }));
    expect(() => pool.replay('x')).toThrow(/not played/i);
  });

  it('emits update', () => {
    const pool = makePool();
    mockGetItemById.mockReturnValue(makeItem({ id: 'x', status: 'played' }));
    mockGetMaxQueuePosition.mockReturnValue(0);
    const spy = vi.fn();
    pool.on('update', spy);
    pool.replay('x');
    expect(spy).toHaveBeenCalled();
  });
});

// ─── enrich-link-dedup ────────────────────────────────────────────────────────

describe('PoolManager — enrich-link-dedup (runPipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLastSubmissionAt.mockReturnValue(null);
    mockGetClipCount.mockReturnValue(0);
    mockInsertItem.mockReturnValue(undefined);
    mockGetMaxQueuePosition.mockReturnValue(3);
    mockGetPlayedItems.mockReturnValue([]);
    // Default: sanitize always passes with a link input
    mockSanitize.mockReturnValue({ ok: true, validated: { type: 'link', url: 'https://example.com' } });
  });

  it('assigns queue position when URL is unique (not in main or played)', async () => {
    const pool = makePool();
    mockGetReadyItems.mockReturnValue([]);
    mockGetPlayedItems.mockReturnValue([]);
    mockResolve.mockResolvedValue({ url: 'https://example.com', title: null, description: null, thumbnail: null, siteName: null, caption: null });

    pool.addItem({ type: 'link', url: 'https://example.com' }, 'p1');
    await new Promise(r => setImmediate(r));

    expect(mockUpdateQueuePosition).toHaveBeenCalledWith(expect.any(String), 4);
  });

  it('does NOT assign queue position when URL exists in queue.main', async () => {
    const pool = makePool();
    const dupeUrl = 'https://dupe.com';
    mockGetReadyItems.mockReturnValue([
      makeItem({ id: 'existing', queuePosition: 1, content: { url: dupeUrl, title: null, description: null, thumbnail: null, siteName: null, caption: null } }),
    ]);
    mockGetPlayedItems.mockReturnValue([]);
    mockResolve.mockResolvedValue({ url: dupeUrl, title: null, description: null, thumbnail: null, siteName: null, caption: null });

    pool.addItem({ type: 'link', url: dupeUrl }, 'p1');
    await new Promise(r => setImmediate(r));

    expect(mockUpdateQueuePosition).not.toHaveBeenCalled();
  });

  it('does NOT assign queue position when URL exists in queue.played', async () => {
    const pool = makePool();
    const dupeUrl = 'https://played.com';
    mockGetReadyItems.mockReturnValue([]);
    mockGetPlayedItems.mockReturnValue([
      makeItem({ id: 'existing', status: 'played', content: { url: dupeUrl, title: null, description: null, thumbnail: null, siteName: null, caption: null } }),
    ]);
    mockResolve.mockResolvedValue({ url: dupeUrl, title: null, description: null, thumbnail: null, siteName: null, caption: null });

    pool.addItem({ type: 'link', url: dupeUrl }, 'p1');
    await new Promise(r => setImmediate(r));

    expect(mockUpdateQueuePosition).not.toHaveBeenCalled();
  });

  it('assigns queue position for note (no URL field)', async () => {
    const pool = makePool();
    mockSanitize.mockReturnValue({ ok: true, validated: { type: 'note', text: 'hello world' } });
    mockGetReadyItems.mockReturnValue([]);
    mockGetPlayedItems.mockReturnValue([]);
    mockResolve.mockResolvedValue({ text: 'hello world' });

    pool.addItem({ type: 'note', text: 'hello world' }, 'p1');
    await new Promise(r => setImmediate(r));

    expect(mockUpdateQueuePosition).toHaveBeenCalledWith(expect.any(String), 4);
  });
});
