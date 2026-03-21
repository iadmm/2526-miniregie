// SceneCompositor — orchestrates SceneEngine, LowerThirdEngine, ClockEngine.
// Manages queue consumption, regime state (normal / hold / buffer), and scene lifecycle.
// Does NOT render anything itself — all DOM work is delegated to the engines.
//
// Regime rules:
//   normal  — FIFO queue consumption, durations from ENGINE_CONFIG.DURATIONS.normal
//   hold    — queue empty; retry every 2 s; current primary held at extended duration
//   buffer  — every BUFFER_EVERY visual scenes, pause BUFFER_DURATION ms with no primary
//
// Admin skip: detected via updateSnapshot() — if active primary disappears from the
// snapshot (evicted / status changed), the compositor cancels the scene immediately.

import type { Socket } from 'socket.io-client';
import type { MediaItem, MediaType, GlobalState } from '@shared/types';
import type { SceneEngine } from './scene-engine.js';
import type { LowerThirdEngine } from './lower-third-engine.js';
import { ENGINE_CONFIG } from './engine-config.js';

type Regime = 'normal' | 'hold' | 'buffer';

export class SceneCompositor {
  private mounted = false;
  private socket: Socket;
  private scene: SceneEngine;
  private lowerThird: LowerThirdEngine;

  private snapshot: MediaItem[] = [];
  private regime: Regime = 'normal';
  private visualCount = 0;

  // IDs of currently displayed items (excluded from next queue picks)
  private primaryId:   string | null = null;
  private companionId: string | null = null;

  // Prefetched next primary — populated PREFETCH_LEAD ms before scene end
  private prefetchCandidate: MediaItem | null = null;

  private holdTimer:   ReturnType<typeof setTimeout> | null = null;
  private bufferTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(scene: SceneEngine, lowerThird: LowerThirdEngine, socket: Socket) {
    this.scene      = scene;
    this.lowerThird = lowerThird;
    this.socket     = socket;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  mount(initialState: GlobalState): void {
    this.mounted  = true;
    this.snapshot = initialState.pool.queueSnapshot;

    // Wire SceneEngine callbacks
    this.scene.onSceneEnd = (primary) => {
      if (!this.mounted) return;
      this.primaryId   = null;
      this.companionId = null; // SceneEngine already cleared companion without onCompanionEnd
      this.markDisplayed(primary);

      if (this.isVisual(primary) && this.visualCount % ENGINE_CONFIG.BUFFER_EVERY === 0) {
        this.enterBuffer();
      } else {
        this.scheduleNext();
      }
    };

    this.scene.onCompanionEnd = (companion) => {
      if (!this.mounted) return;
      this.companionId = null;
      this.markDisplayed(companion);

      // If primary is still a YouTube video, try to fill the companion slot again
      if (this.primaryId !== null) {
        const primary = this.snapshot.find(i => i.id === this.primaryId);
        if (primary?.type === 'youtube') this.scheduleCompanion();
      }
    };

    this.scene.onPrefetchNeeded = () => {
      if (!this.mounted) return;
      this.prefetchCandidate = this.pickPrimary() ?? null;
    };

    this.lowerThird.updateTicker(this.snapshot);
    this.scheduleNext();
  }

  /**
   * Called whenever a new GlobalState snapshot arrives via socket 'state' event.
   * Handles:
   *   - ticker refresh
   *   - admin eviction of active items
   *   - hold → normal transition when items appear
   */
  updateSnapshot(snapshot: MediaItem[]): void {
    this.snapshot = snapshot;
    this.lowerThird.updateTicker(snapshot);

    // If the active primary was evicted / skipped by admin, cancel the scene
    if (this.primaryId !== null) {
      const still = snapshot.find(i => i.id === this.primaryId && i.status === 'ready');
      if (!still) {
        this.scene.clearAll();
        this.primaryId       = null;
        this.companionId     = null;
        this.prefetchCandidate = null;
        this.clearHoldTimer();
        this.clearBufferTimer();
        this.regime = 'normal';
        this.scheduleNext();
        return;
      }
    }

    // Exit hold immediately if items are now available
    if (this.regime === 'hold' && this.queueMain().length > 0) {
      this.exitHold();
      this.scheduleNext();
    }
  }

  destroy(): void {
    this.mounted = false;
    this.clearHoldTimer();
    this.clearBufferTimer();
    this.socket.emit('jam:state-update', { activeItemIds: [], regime: 'normal' });
  }

  // ── Queue helpers ──────────────────────────────────────────────────────────

  private queueMain(opts?: { types?: MediaType[] }): MediaItem[] {
    const excluded = new Set<string>();
    if (this.primaryId)   excluded.add(this.primaryId);
    if (this.companionId) excluded.add(this.companionId);

    let items = this.snapshot.filter(i =>
      i.status === 'ready' &&
      !excluded.has(i.id),
    );

    if (opts?.types) {
      const allowed = new Set(opts.types);
      items = items.filter(i => allowed.has(i.type as MediaType));
    }

    return items.sort(fifoSort);
  }

  private pickPrimary(): MediaItem | undefined {
    return this.queueMain()[0];
  }

  private pickCompanion(primaryType: MediaType): MediaItem | undefined {
    // YouTube primary → any visual or note companion
    // Visual primary → note companion only (avoids two competing visuals)
    const types: MediaType[] = primaryType === 'youtube'
      ? ['photo', 'gif', 'clip', 'note']
      : ['note'];

    return this.queueMain({ types })[0];
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────

  private scheduleNext(): void {
    if (!this.mounted || this.regime === 'buffer') return;

    const next = this.prefetchCandidate ?? this.pickPrimary();
    this.prefetchCandidate = null;

    if (!next) {
      this.enterHold();
      return;
    }

    this.exitHold();
    this.startPrimary(next);
  }

  private startPrimary(item: MediaItem): void {
    if (!this.mounted) return;

    this.primaryId = item.id;
    if (this.isVisual(item)) this.visualCount++;

    const duration = this.primaryDuration(item);
    this.scene.playPrimary(item, duration);
    this.lowerThird.showAttribution(item);
    this.emitState();

    // Schedule companion asynchronously so the layout resolves first
    setTimeout(() => {
      if (!this.mounted || this.primaryId !== item.id) return;
      this.scheduleCompanion();
    }, 0);
  }

  private scheduleCompanion(): void {
    if (!this.mounted || !this.primaryId) return;

    const primary = this.snapshot.find(i => i.id === this.primaryId);
    if (!primary) return;

    const companion = this.pickCompanion(primary.type as MediaType);
    if (!companion) return;

    this.companionId = companion.id;
    this.scene.playCompanion(companion, this.companionDuration(companion));
    this.emitState();
  }

  // ── Hold regime ────────────────────────────────────────────────────────────

  private enterHold(): void {
    if (this.regime === 'hold') return;
    this.regime = 'hold';
    this.emitState();
    this.scheduleHoldRetry();
  }

  private scheduleHoldRetry(): void {
    this.clearHoldTimer();
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      if (this.mounted) this.scheduleNext();
    }, 2_000);
  }

  private exitHold(): void {
    if (this.regime !== 'hold') return;
    this.clearHoldTimer();
    this.regime = 'normal';
    this.emitState();
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) { clearTimeout(this.holdTimer); this.holdTimer = null; }
  }

  // ── Buffer regime ──────────────────────────────────────────────────────────

  private enterBuffer(): void {
    this.regime = 'buffer';
    this.emitState();
    this.bufferTimer = setTimeout(() => {
      this.bufferTimer = null;
      if (!this.mounted) return;
      this.regime = 'normal';
      this.emitState();
      this.scheduleNext();
    }, ENGINE_CONFIG.BUFFER_DURATION);
  }

  private clearBufferTimer(): void {
    if (this.bufferTimer !== null) { clearTimeout(this.bufferTimer); this.bufferTimer = null; }
  }

  // ── Duration helpers ───────────────────────────────────────────────────────

  private primaryDuration(item: MediaItem): number {
    if (item.type === 'youtube') return 0; // driven by YT ended event

    if (item.type === 'clip') {
      const c = item.content as { duration: number };
      return Math.max(c.duration * 1_000, ENGINE_CONFIG.MIN_SCENE_DURATION);
    }

    const d = ENGINE_CONFIG.DURATIONS[item.type as keyof typeof ENGINE_CONFIG.DURATIONS];
    if (!d) return 20_000;

    // Stretch scene duration in hold regime (pool is empty)
    return this.regime === 'hold' ? d.extended : d.normal;
  }

  private companionDuration(item: MediaItem): number {
    const d = ENGINE_CONFIG.COMPANION_DURATIONS[item.type as keyof typeof ENGINE_CONFIG.COMPANION_DURATIONS];
    return d ?? 20_000;
  }

  private isVisual(item: MediaItem): boolean {
    return (
      item.type === 'photo' ||
      item.type === 'gif'   ||
      item.type === 'clip'  ||
      (item.type === 'link' && !!(item.content as { thumbnail: string | null }).thumbnail)
    );
  }

  // ── Server communication ───────────────────────────────────────────────────

  private markDisplayed(item: MediaItem): void {
    // Optimistically remove from local snapshot so scheduleNext() cannot re-pick
    // the same item before the server confirms the status change.
    this.snapshot = this.snapshot.filter(i => i.id !== item.id);
    this.socket.emit('pool:mark', { itemId: item.id, event: 'displayed' });
  }

  private emitState(): void {
    const ids = [this.primaryId, this.companionId].filter(Boolean) as string[];
    this.socket.emit('jam:state-update', { activeItemIds: ids, regime: this.regime });
  }
}

// Mirrors PoolManager.fifoSort: explicit queuePosition first, then FIFO by submittedAt.
function fifoSort(a: MediaItem, b: MediaItem): number {
  const aPos = a.queuePosition;
  const bPos = b.queuePosition;
  if (aPos !== null && bPos !== null) return aPos - bPos;
  if (aPos !== null) return -1;
  if (bPos !== null) return 1;
  return a.submittedAt - b.submittedAt;
}
