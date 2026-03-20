import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { sanitize } from './sanitize.js';
import { guard } from './guard.js';
import {
  insertItem, updateStatus, updateContent, updateSubmittedAt, updateQueuePosition,
  getReadyItems, getPlayedItems, getItemById, getLastSubmissionAt, getClipCount,
  getMaxQueuePosition, batchUpdateQueuePositions, insertEvent,
  type ReadyItemFilters, type ScoredRow, type PlayedRow,
} from '../db/queries.js';
import type { GlobalState, MediaItem, MediaType, ScoredMediaItem } from '../../../shared/types.js';
import type { RawInput, ValidatedInput } from './types.js';
import { resolve } from './resolve.js';
import { getJamConfig } from '../jam-config.js';

// ─── Filter types ─────────────────────────────────────────────────────────────

export interface NextItemFilters {
  types?:          MediaType[];
  submittedAfter?: number;
}

export interface GetMainFilters {
  types?:        MediaType[];
  excludeTypes?: MediaType[];
}

export interface GetPlayedFilters {
  types?: MediaType[];
}

export interface GetQueueFilters {
  types?:           MediaType[];
  excludeTypes?:    MediaType[];
  submittedAfter?:  number;
  submittedBefore?: number;
}

export interface GetItemsFilters {
  types?:          MediaType[];
  submittedAfter?: number;
  sort?:           'submittedAt ASC' | 'submittedAt DESC';
}

// ─── PoolManager ──────────────────────────────────────────────────────────────

export class PoolManager extends EventEmitter {
  private readonly getJamState: () => GlobalState['jam'];
  private readonly cfg: ReturnType<typeof getJamConfig>['pool'];

  constructor(options: { getJamState: () => GlobalState['jam'] }) {
    super();
    this.getJamState = options.getJamState;
    this.cfg = getJamConfig().pool;
  }

  // ─── Submission pipeline ────────────────────────────────────────────────────

  addItem(raw: RawInput, participantId: string): MediaItem {
    // 1. Sanitize
    const sanitized = sanitize(raw);
    if (!sanitized.ok) throw new Error(sanitized.error);

    // 2. Clip quota check (before guard to keep guard pure)
    if (raw.type === 'clip') {
      const count = getClipCount(participantId);
      const quota = this.cfg.clipQuotaPerParticipant;
      if (count >= quota) throw new Error(`Clip quota reached (max ${quota} per JAM)`);
    }

    // 3. Guard — JAM status + rate limit
    const jamState = this.getJamState();
    const lastSubmissionAt = getLastSubmissionAt(participantId);
    const guarded = guard({ jamStatus: jamState.status, participantId, lastSubmissionAt });
    if (!guarded.ok) throw new Error(guarded.error);

    // 4. Create item as pending — respond immediately
    // Priority is a DB-only ordering concern: interview=200, standard=100
    const priority = raw.type === 'interview' ? 200 : 100;
    const item: MediaItem = {
      id:            randomUUID(),
      type:          sanitized.validated.type as MediaType,
      content:       {} as MediaItem['content'], // filled by RESOLVE
      queuePosition: null,
      status:        'pending',
      submittedAt:   Date.now(),
      author:        { participantId, displayName: '', team: '', role: '' }, // snapshot filled by caller
    };

    insertItem(item, priority);

    // 5. Async pipeline — RESOLVE → ENRICH → ready
    const filePath = 'filePath' in raw ? raw.filePath : undefined;
    void this.runPipeline(item.id, sanitized.validated, filePath);

    return item;
  }

  private async runPipeline(itemId: string, validated: ValidatedInput, filePath?: string): Promise<void> {
    try {
      // RESOLVE: move files, run ffprobe, fetch OG metadata, etc.
      const content = await resolve({
        type:     validated.type,
        content:  validated as ValidatedInput['content'],
        filePath,
      });

      updateContent(itemId, content);

      // enrich-link-dedup: if resolved content has a URL already present in
      // queue.main or queue.played, leave queuePosition = null (item sorts at
      // the back of unpositioned items). Otherwise assign the next position so
      // the item joins queue.main.
      const url = (content as { url?: string }).url;
      if (url) {
        const mainItems   = getReadyItems({ positionedOnly: true });
        const playedItems = getPlayedItems();
        const isDupe =
          mainItems.some(i => (i.content as { url?: string }).url === url) ||
          playedItems.some(i => (i.content as { url?: string }).url === url);
        if (!isDupe) {
          updateQueuePosition(itemId, (getMaxQueuePosition() ?? 0) + 1);
        }
      } else {
        // No URL (note, ticker, interview) — always assign next position
        updateQueuePosition(itemId, (getMaxQueuePosition() ?? 0) + 1);
      }

      updateStatus(itemId, 'ready');

      insertEvent({
        id: randomUUID(), itemId, type: 'enriched',
        appId: null, payload: null, createdAt: Date.now(),
      });

      this.emit('item:ready', itemId);
      this.emit('update');
    } catch {
      updateStatus(itemId, 'evicted');
      insertEvent({
        id: randomUUID(), itemId, type: 'evicted',
        appId: null, payload: { reason: 'unresolvable' }, createdAt: Date.now(),
      });
      this.emit('update');
    }
  }

  // ─── Direct insert (admin / narrator bypass) ────────────────────────────────

  // Inserts a fully-formed item directly, bypassing sanitize/guard.
  // Use only for system:admin and system:narrator items.
  // priority: DB-only ordering value (pinned=999, interview=200, standard=100, ticker=80)
  addDirectItem(item: MediaItem, priority = 100): void {
    insertItem(item, priority);
    this.emit('update');
  }

  // ─── Stats (for GlobalState) ────────────────────────────────────────────────

  getStats(holdCount = 0): GlobalState['pool'] {
    const rows = getReadyItems({ excludeTypes: ['ticker'] });

    const byType: Record<string, number> = {};
    for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;

    return {
      total:         rows.length,
      queueSnapshot: [...rows].sort(fifoSort).slice(0, 15),
      byType,
      holdCount,
    };
  }

  // ─── Admin queue view ────────────────────────────────────────────────────────

  getScoredQueue(): ScoredMediaItem[] {
    const rows = getReadyItems({ excludeTypes: ['ticker'] });
    return [...rows].sort(fifoSort).map(row => ({
      ...row,
      displayedCount: row.displayedCount,
      skippedCount:   row.skippedCount,
    }));
  }

  // ─── Session-2 queue reads ──────────────────────────────────────────────────

  // queue.main: ready items with an explicit position, sorted by that position.
  getMain(filters: GetMainFilters = {}): MediaItem[] {
    const dbFilters: ReadyItemFilters = { positionedOnly: true };
    if (filters.types)        dbFilters.types        = filters.types;
    if (filters.excludeTypes) dbFilters.excludeTypes = filters.excludeTypes;
    return getReadyItems(dbFilters).sort(fifoSort);
  }

  // queue.played: played items, ordered by getPlayedItems (playedAt DESC).
  getPlayed(filters: GetPlayedFilters = {}): MediaItem[] {
    const rows = getPlayedItems();
    if (!filters.types?.length) return rows;
    return rows.filter(r => filters.types!.includes(r.type));
  }

  // ─── Session-2 queue writes ─────────────────────────────────────────────────

  // Reassigns queue_position for every item in queue.main in the given order.
  // ids must contain exactly the same IDs as queue.main — throws otherwise.
  reorder(ids: string[]): void {
    const main = this.getMain();
    const mainIds   = [...main.map(i => i.id)].sort();
    const inputIds  = [...ids].sort();
    if (
      mainIds.length !== inputIds.length ||
      mainIds.some((id, i) => id !== inputIds[i])
    ) {
      throw new Error('reorder ids must match queue.main exactly');
    }
    batchUpdateQueuePositions(ids.map((id, idx) => ({ id, queuePosition: idx + 1 })));
    this.emit('update');
  }

  // Moves a played item back to the end of queue.main with a 'replayed' event.
  replay(id: string): void {
    const item = getItemById(id);
    if (!item) throw new Error(`Item ${id} not found`);
    if (item.status !== 'played') throw new Error(`Item ${id} is not played`);
    const maxPos = getMaxQueuePosition() ?? 0;
    updateQueuePosition(id, maxPos + 1);
    updateStatus(id, 'ready');
    insertEvent({ id: randomUUID(), itemId: id, type: 'replayed', appId: null, payload: null, createdAt: Date.now() });
    this.emit('update');
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  nextItem(filters: NextItemFilters = {}): MediaItem | null {
    const dbFilters: ReadyItemFilters = { excludeTypes: ['ticker'] };
    if (filters.types)          dbFilters.types          = filters.types;
    if (filters.submittedAfter) dbFilters.submittedAfter = filters.submittedAfter;

    const rows = getReadyItems(dbFilters);
    if (rows.length === 0) return null;

    return rows.sort(fifoSort)[0] ?? null;
  }

  getQueue(filters: GetQueueFilters = {}): MediaItem[] {
    const dbFilters: ReadyItemFilters = {};
    if (filters.types)           dbFilters.types           = filters.types;
    if (filters.excludeTypes)    dbFilters.excludeTypes    = filters.excludeTypes;
    if (!filters.types)          dbFilters.excludeTypes    = [...(filters.excludeTypes ?? []), 'ticker'];
    if (filters.submittedAfter)  dbFilters.submittedAfter  = filters.submittedAfter;
    if (filters.submittedBefore) dbFilters.submittedBefore = filters.submittedBefore;

    return getReadyItems(dbFilters).sort(fifoSort);
  }

  getItems(filters: GetItemsFilters = {}): MediaItem[] {
    const dbFilters: ReadyItemFilters = {};
    if (filters.types) dbFilters.types = filters.types;

    const ready  = getReadyItems(dbFilters);
    const played = getPlayedItems();

    let rows: MediaItem[] = [...ready, ...played];

    if (filters.types?.length) {
      rows = rows.filter(r => filters.types!.includes(r.type));
    }
    if (filters.submittedAfter) {
      rows = rows.filter(r => r.submittedAt > filters.submittedAfter!);
    }

    return filters.sort === 'submittedAt DESC'
      ? rows.sort((a, b) => b.submittedAt - a.submittedAt)
      : rows.sort((a, b) => a.submittedAt - b.submittedAt);
  }

  // ─── Write (called by apps) ─────────────────────────────────────────────────

  markDisplayed(itemId: string, appId: string): void {
    const item = getItemById(itemId);
    if (!item) return;

    insertEvent({ id: randomUUID(), itemId, type: 'displayed', appId, payload: null, createdAt: Date.now() });
    updateStatus(itemId, 'played');

    this.emit('update');
  }

  getPlayedItems(): PlayedRow[] {
    return getPlayedItems();
  }

  requeue(id: string): void {
    // Reset submittedAt to now so the item lands at the back of the FIFO queue.
    // Priority stays at its existing DB value (no change needed).
    updateSubmittedAt(id, Date.now());
    updateStatus(id, 'ready');
    this.emit('update');
  }

  markSkipped(itemId: string, appId: string): void {
    insertEvent({ id: randomUUID(), itemId, type: 'skipped', appId, payload: null, createdAt: Date.now() });
    this.emit('update');
  }

  markHeld(itemId: string, appId: string, durationMs: number): void {
    insertEvent({ id: randomUUID(), itemId, type: 'held', appId, payload: { duration: durationMs }, createdAt: Date.now() });
  }

  evict(id: string, reason: 'manual' | 'unresolvable'): void {
    updateStatus(id, 'evicted');
    insertEvent({ id: randomUUID(), itemId: id, type: 'evicted', appId: null, payload: { reason }, createdAt: Date.now() });
    this.emit('update');
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.emit('update');
  }

}

// ─── FIFO sort: explicit queuePosition first, then submission time ────────────
// Items with a queuePosition sort by that position (ascending).
// Items without a queuePosition (null) sort after all positioned items, by submittedAt ASC.

function fifoSort(a: ScoredRow, b: ScoredRow): number {
  const aPos = a.queuePosition;
  const bPos = b.queuePosition;

  if (aPos !== null && bPos !== null) return aPos - bPos;
  if (aPos !== null) return -1; // a has position, b does not → a first
  if (bPos !== null) return 1;  // b has position, a does not → b first
  return a.submittedAt - b.submittedAt; // neither has position → FIFO by submission
}
