import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { sanitize } from './sanitize.js';
import { guard } from './guard.js';
import {
  insertItem, updateStatus, updateContent, updateQueuePosition,
  getReadyItems, getPlayedItems, getItemById, getLastSubmissionAt, getClipCount,
  getMaxQueuePosition, batchUpdateQueuePositions, insertEvent,
  type ReadyItemFilters, type ScoredRow, type PlayedRow,
} from '../db/queries.js';
import type { GlobalState, MediaItem, MediaType, ScoredMediaItem } from '@shared/types';
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

    // 4. Create item as pending — queue position assigned after pipeline
    // photo-url / gif-url are internal pipeline types that resolve to photo / gif
    const MEDIA_TYPE_ALIASES: Partial<Record<string, MediaType>> = { 'photo-url': 'photo', 'gif-url': 'gif' };
    const item: MediaItem = {
      id:            randomUUID(),
      type:          (MEDIA_TYPE_ALIASES[sanitized.validated.type] ?? sanitized.validated.type) as MediaType,
      content:       {} as MediaItem['content'],
      queuePosition: null,
      status:        'pending',
      submittedAt:   Date.now(),
      author:        { participantId, displayName: '', team: '', role: '' },
    };

    insertItem(item);

    // 5. Async pipeline — RESOLVE → assign position → ready
    const filePath = 'filePath' in raw ? raw.filePath : undefined;
    void this.runPipeline(item.id, sanitized.validated, filePath);

    return item;
  }

  private async runPipeline(itemId: string, validated: ValidatedInput, filePath?: string): Promise<void> {
    try {
      const content = await resolve({
        type:    validated.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: validated as any,
        ...(filePath !== undefined ? { filePath } : {}),
      });

      updateContent(itemId, content);
      updateQueuePosition(itemId, (getMaxQueuePosition() ?? 0) + 1);
      updateStatus(itemId, 'ready');
      insertEvent({ id: randomUUID(), itemId, type: 'enriched', appId: null, payload: null, createdAt: Date.now() });
      this.emit('item:ready', itemId);
      this.emit('update');
    } catch (err) {
      console.error('[pool] pipeline failed for item', itemId, err);
      updateStatus(itemId, 'evicted');
      insertEvent({ id: randomUUID(), itemId, type: 'evicted', appId: null, payload: { reason: 'unresolvable' }, createdAt: Date.now() });
      this.emit('update');
    }
  }

  // ─── Direct insert (admin / narrator bypass) ────────────────────────────────

  addDirectItem(item: MediaItem): void {
    const position = (getMaxQueuePosition() ?? 0) + 1;
    insertItem({ ...item, queuePosition: position });
    this.emit('update');
  }

  // ─── Stats (for GlobalState) ────────────────────────────────────────────────

  getStats(holdCount = 0): GlobalState['pool'] {
    const rows = getReadyItems();
    const byType: Record<string, number> = {};
    for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;
    return {
      total:         rows.length,
      queueSnapshot: rows.slice(0, 15),
      byType,
      holdCount,
    };
  }

  // ─── Queue reads ─────────────────────────────────────────────────────────────

  // All ready items in queue order (position ASC from DB). Tickers excluded by default.
  getMain(filters: GetMainFilters = {}): MediaItem[] {
    const dbFilters: ReadyItemFilters = {};
    if (filters.types)        dbFilters.types        = filters.types;
    if (filters.excludeTypes) dbFilters.excludeTypes = filters.excludeTypes;
    return getReadyItems(dbFilters);
  }

  // Played items, most recent first.
  getPlayed(filters: GetPlayedFilters = {}): MediaItem[] {
    const rows = getPlayedItems();
    if (!filters.types?.length) return rows;
    return rows.filter(r => filters.types!.includes(r.type));
  }

  getPlayedItems(): PlayedRow[] {
    return getPlayedItems();
  }

  // Admin scored view (same as getMain but with event counts).
  getScoredQueue(): ScoredMediaItem[] {
    return getReadyItems({ excludeTypes: ['ticker'] });
  }

  // Next item to broadcast.
  nextItem(filters: NextItemFilters = {}): MediaItem | null {
    const dbFilters: ReadyItemFilters = { excludeTypes: ['ticker'] };
    if (filters.types)          dbFilters.types          = filters.types;
    if (filters.submittedAfter) dbFilters.submittedAfter = filters.submittedAfter;
    return getReadyItems(dbFilters)[0] ?? null;
  }

  // ─── Queue writes ────────────────────────────────────────────────────────────

  // Reassigns positions for all items in queue.main in the given order.
  reorder(ids: string[]): void {
    const main    = this.getMain();
    const mainIds = [...main.map(i => i.id)].sort();
    const inputIds = [...ids].sort();
    if (
      mainIds.length !== inputIds.length ||
      mainIds.some((id, i) => id !== inputIds[i])
    ) {
      throw new Error('reorder ids must match queue.main exactly');
    }
    batchUpdateQueuePositions(ids.map((id, idx) => ({ id, queuePosition: idx + 1 })));
    this.emit('update');
  }

  // Moves a played item back to the end of the queue.
  replay(id: string): void {
    const item = getItemById(id);
    if (!item) throw new Error(`Item ${id} not found`);
    if (item.status !== 'played') throw new Error(`Item ${id} is not played`);
    updateQueuePosition(id, (getMaxQueuePosition() ?? 0) + 1);
    updateStatus(id, 'ready');
    insertEvent({ id: randomUUID(), itemId: id, type: 'replayed', appId: null, payload: null, createdAt: Date.now() });
    this.emit('update');
  }

  // Sends a ready item back to the end of the queue.
  requeue(id: string): void {
    updateQueuePosition(id, (getMaxQueuePosition() ?? 0) + 1);
    updateStatus(id, 'ready');
    this.emit('update');
  }

  // ─── Broadcast events ────────────────────────────────────────────────────────

  markDisplayed(itemId: string, appId: string): void {
    const item = getItemById(itemId);
    if (!item) {
      console.warn(`[pool] markDisplayed: item ${itemId} not found — skipping (stale timer?)`);
      return;
    }
    try {
      insertEvent({ id: randomUUID(), itemId, type: 'displayed', appId, payload: null, createdAt: Date.now() });
    } catch (err) {
      console.warn(`[pool] markDisplayed: failed to insert event for ${itemId}`, err);
    }
    updateStatus(itemId, 'played');
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
