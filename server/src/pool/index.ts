import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { computeScore } from './scoring.js';
import { sanitize } from './sanitize.js';
import { guard } from './guard.js';
import {
  insertItem, updateStatus, updateContent, updatePriority, updatePinned, clearAllPinned,
  getReadyItems, getItemById, getLastSubmissionAt, getClipCount, insertEvent,
  type ReadyItemFilters, type ScoredRow,
} from '../db/queries.js';
import type { GlobalState, MediaItem, MediaType, ScoredMediaItem } from '../../../shared/types.js';
import type { RawInput, ValidatedInput } from './types.js';
import { resolve } from './resolve.js';
import { getJamConfig } from '../jam-config.js';

const SAME_AUTHOR_PENALTY = 30;

// ─── Filter types ─────────────────────────────────────────────────────────────

export interface NextItemFilters {
  types?:          MediaType[];
  submittedAfter?: number;
  excludeAuthorIds?: string[];
}

export interface GetQueueFilters {
  types?:           MediaType[];
  excludeTypes?:    MediaType[];
  submittedAfter?:  number;
  submittedBefore?: number;
  withCooldown?:    boolean; // default: true
  scoring?:         boolean; // default: true — false = sort by submittedAt ASC
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
  // authorId → timestamp of last display
  private recentDisplayedAuthors = new Map<string, number>();

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
    const priority = raw.type === 'interview' ? 200 : 100;
    const item: MediaItem = {
      id:          randomUUID(),
      type:        sanitized.validated.type as MediaType,
      content:     {} as MediaItem['content'], // filled by RESOLVE
      priority,
      status:      'pending',
      pinned:      false,
      submittedAt: Date.now(),
      author:      { participantId, displayName: '', team: '', role: '' }, // snapshot filled by caller
    };

    insertItem(item);

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
  addDirectItem(item: MediaItem): void {
    insertItem(item);
    this.emit('update');
  }

  // ─── Stats (for GlobalState) ────────────────────────────────────────────────

  getStats(holdCount = 0): GlobalState['pool'] {
    const now = Date.now();
    const rows = getReadyItems({ excludeTypes: ['ticker'] });
    const authorCounts = this.computeAuthorReadyCounts(rows);

    let freshCount  = 0;
    let pinnedCount = 0;
    const byType: Record<string, number> = {};

    const scored = rows
      .map(row => {
        if (now - row.submittedAt < this.cfg.freshItemWindowMs) freshCount++;
        if (row.pinned) pinnedCount++;
        byType[row.type] = (byType[row.type] ?? 0) + 1;
        return {
          row,
          score: computeScore(row, {
            displayed:       row.displayedCount,
            skipped:         row.skippedCount,
            sameAuthorReady: (authorCounts.get(row.author.participantId) ?? 1) - 1,
          }, now),
        };
      })
      .sort((a, b) => b.score - a.score);

    const scoreMax = scored.length > 0 ? (scored[0]?.score ?? null) : null;
    const scoreMin = scored.length > 0 ? (scored[scored.length - 1]?.score ?? null) : null;

    return {
      total:         rows.length,
      fresh:         freshCount,
      queueSnapshot: scored.slice(0, 15).map(s => s.row),
      byType,
      pinned:    pinnedCount,
      scoreMax,
      scoreMin,
      holdCount,
    };
  }

  // ─── Admin scored queue ─────────────────────────────────────────────────────

  getScoredQueue(now: number = Date.now()): ScoredMediaItem[] {
    const rows = getReadyItems({ excludeTypes: ['ticker'] });
    const authorCounts = this.computeAuthorReadyCounts(rows);

    return rows
      .map(row => {
        const score = computeScore(row, {
          displayed:       row.displayedCount,
          skipped:         row.skippedCount,
          sameAuthorReady: (authorCounts.get(row.author.participantId) ?? 1) - 1,
        }, now);

        // Item cooldown: hard filter expiry timestamp, null if not in cooldown
        const cooldownEndsAt = (row.lastActivityAt !== null && now - row.lastActivityAt < this.cfg.itemCooldownMs)
          ? row.lastActivityAt + this.cfg.itemCooldownMs
          : null;

        // Author display cooldown: based on in-memory Map populated by markDisplayed()
        const authorLastDisplay = this.recentDisplayedAuthors.get(row.author.participantId);
        const authorCooldownEndsAt = (authorLastDisplay !== undefined && now - authorLastDisplay < this.cfg.authorDisplayCooldownMs)
          ? authorLastDisplay + this.cfg.authorDisplayCooldownMs
          : null;

        const scoredItem: ScoredMediaItem = {
          ...row,
          score,
          displayedCount:       row.displayedCount,
          skippedCount:         row.skippedCount,
          cooldownEndsAt,
          authorCooldownEndsAt,
        };
        return scoredItem;
      })
      .sort((a, b) => b.score - a.score);
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  nextItem(filters: NextItemFilters = {}): MediaItem | null {
    const now = Date.now();
    const dbFilters: ReadyItemFilters = { excludeTypes: ['ticker'] };
    if (filters.types)          dbFilters.types          = filters.types;
    if (filters.submittedAfter) dbFilters.submittedAfter = filters.submittedAfter;

    const rows = getReadyItems(dbFilters);

    // Compute per-author ready count for same-author penalty
    const authorReadyCount = this.computeAuthorReadyCounts(rows);

    // Active author cooldown
    const cooldownAuthors = new Set(
      [...this.recentDisplayedAuthors.entries()]
        .filter(([, ts]) => now - ts < this.cfg.authorDisplayCooldownMs)
        .map(([id]) => id),
    );

    const candidates = rows
      .filter(row => {
        // Item cooldown
        if (row.lastActivityAt && now - row.lastActivityAt < this.cfg.itemCooldownMs) return false;
        // Author display cooldown — skip if queue has other options
        if (cooldownAuthors.has(row.author.participantId)) return false;
        // Explicit exclude
        if (filters.excludeAuthorIds?.includes(row.author.participantId)) return false;
        return true;
      });

    // If all candidates are filtered by author cooldown, relax it
    const pool = candidates.length > 0 ? candidates : rows.filter(row =>
      !row.lastActivityAt || now - row.lastActivityAt >= this.cfg.itemCooldownMs,
    );

    if (pool.length === 0) return null;

    // Score and pick best
    return pool.reduce<ScoredRow | null>((best, row) => {
      const score = computeScore(row, {
        displayed:       row.displayedCount,
        skipped:         row.skippedCount,
        sameAuthorReady: (authorReadyCount.get(row.author.participantId) ?? 1) - 1,
      }, now);
      const bestScore = best ? computeScore(best, {
        displayed:       best.displayedCount,
        skipped:         best.skippedCount,
        sameAuthorReady: (authorReadyCount.get(best.author.participantId) ?? 1) - 1,
      }, now) : -Infinity;
      return score > bestScore ? row : best;
    }, null);
  }

  getQueue(filters: GetQueueFilters = {}): MediaItem[] {
    const now = Date.now();
    const withCooldown = filters.withCooldown ?? true;
    const scoring      = filters.scoring      ?? true;

    const dbFilters: ReadyItemFilters = {};
    if (filters.types)           dbFilters.types           = filters.types;
    if (filters.excludeTypes)    dbFilters.excludeTypes    = filters.excludeTypes;
    if (!filters.types)          dbFilters.excludeTypes    = [...(filters.excludeTypes ?? []), 'ticker'];
    if (filters.submittedAfter)  dbFilters.submittedAfter  = filters.submittedAfter;
    if (filters.submittedBefore) dbFilters.submittedBefore = filters.submittedBefore;

    let rows = getReadyItems(dbFilters);

    if (withCooldown) {
      rows = rows.filter(row => !row.lastActivityAt || now - row.lastActivityAt >= this.cfg.itemCooldownMs);
    }

    if (!scoring) {
      return rows.sort((a, b) => a.submittedAt - b.submittedAt);
    }

    const authorReadyCount = this.computeAuthorReadyCounts(rows);
    return rows.sort((a, b) => {
      const scoreA = computeScore(a, { displayed: a.displayedCount, skipped: a.skippedCount, sameAuthorReady: (authorReadyCount.get(a.author.participantId) ?? 1) - 1 }, now);
      const scoreB = computeScore(b, { displayed: b.displayedCount, skipped: b.skippedCount, sameAuthorReady: (authorReadyCount.get(b.author.participantId) ?? 1) - 1 }, now);
      return scoreB - scoreA;
    });
  }

  getItems(filters: GetItemsFilters = {}): MediaItem[] {
    const dbFilters: ReadyItemFilters = {};
    if (filters.types)          dbFilters.types          = filters.types;
    if (filters.submittedAfter) dbFilters.submittedAfter = filters.submittedAfter;

    const rows = getReadyItems(dbFilters);
    const sorted = filters.sort === 'submittedAt DESC'
      ? rows.sort((a, b) => b.submittedAt - a.submittedAt)
      : rows.sort((a, b) => a.submittedAt - b.submittedAt);

    return sorted;
  }

  // ─── Write (called by apps) ─────────────────────────────────────────────────

  markDisplayed(itemId: string, appId: string): void {
    // Use getItemById (any status) — item may have been evicted by admin while on screen
    const item = getItemById(itemId);
    if (!item) return; // item deleted entirely, nothing to record

    insertEvent({ id: randomUUID(), itemId, type: 'displayed', appId, payload: null, createdAt: Date.now() });

    // Track author for display cooldown
    this.recentDisplayedAuthors.set(item.author.participantId, Date.now());

    // Auto-evict after display if pinned and still ready
    if (item.pinned && item.status === 'ready') this.evict(itemId, 'post-pin');

    this.emit('update');
  }

  markSkipped(itemId: string, appId: string): void {
    insertEvent({ id: randomUUID(), itemId, type: 'skipped', appId, payload: null, createdAt: Date.now() });
    this.emit('update');
  }

  markHeld(itemId: string, appId: string, durationMs: number): void {
    insertEvent({ id: randomUUID(), itemId, type: 'held', appId, payload: { duration: durationMs }, createdAt: Date.now() });
    // No 'update' emit — held events are invisible to scoring
  }

  pin(id: string): void {
    clearAllPinned();
    updatePriority(id, 999);
    updatePinned(id, true);
    insertEvent({ id: randomUUID(), itemId: id, type: 'pinned', appId: null, payload: null, createdAt: Date.now() });
    this.emit('update');
  }

  evict(id: string, reason: 'manual' | 'post-pin' | 'unresolvable'): void {
    updateStatus(id, 'evicted');
    updatePinned(id, false);
    insertEvent({ id: randomUUID(), itemId: id, type: 'evicted', appId: null, payload: { reason }, createdAt: Date.now() });
    this.emit('update');
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.recentDisplayedAuthors.clear();
    this.emit('update');
  }

  // ─── Author cooldown (for /api/pool/authors) ─────────────────────────────────

  getAuthorCooldownEndsAt(authorId: string, now = Date.now()): number | null {
    const lastDisplay = this.recentDisplayedAuthors.get(authorId);
    if (lastDisplay === undefined) return null;
    const endsAt = lastDisplay + this.cfg.authorDisplayCooldownMs;
    return endsAt > now ? endsAt : null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private computeAuthorReadyCounts(rows: ScoredRow[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const id = row.author.participantId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

}
