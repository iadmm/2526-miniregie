// jam-mode app — server-side entry point
//
// JamModeApp is a thin coordinator:
//   fetch queues → resolve layout → reschedule slot timers → update lower-third → emit

import type { AppId, LayoutName, MediaItem } from "@shared/types";
import type { PoolManager } from "../../pool";
import type { Socket } from "socket.io";
import { getJamConfig } from '../../jam-config.js';
import { BaseApp } from "../base-app.js";
import { resolveLayout, assignSlots, type SlotAssignment } from "./layout-engine.js";
import { SlotTimer, type SlotName, type SlotTimerMeta } from "./slot-timer.js";
import { LowerThirdOrchestrator, type LowerThirdPayload } from "./lower-third.js";
import { SlotChyronOrchestrator, type SlotChyronPayload } from "./slot-chyron.js";
import { EnrichmentPoller } from "./enrich-poller.js";

// ─── JamModeQueues ────────────────────────────────────────────────────────────

export interface JamModeQueues {
  loud:   MediaItem[]; // youtube + clip → loud slot
  visual: MediaItem[]; // photo + gif    → silent visual slot
  note:   MediaItem[]; // note           → silent caption slot
  ticker: MediaItem[]; // ticker         → ticker belt (cycled independently)
}

export type { LowerThirdPayload, SlotChyronPayload };

// ─── JamModeApp ───────────────────────────────────────────────────────────────

export class JamModeApp extends BaseApp {
  readonly id: AppId = 'jam-mode';
  readonly outroMode = 'sequential' as const;

  private readonly pool:             PoolManager;
  private readonly slotTimer:        SlotTimer;
  private readonly lowerThird:       LowerThirdOrchestrator;
  private readonly slotChyron:       SlotChyronOrchestrator;
  private readonly enrichPoller:     EnrichmentPoller;
  private readonly enrichIntervalMs: number;
  private readonly qrIntervalMs:     number;
  private readonly qrHoldMs:         number;
  private qrForced    = false;
  private qrTimer:     ReturnType<typeof setInterval>  | null = null;
  private qrHoldTimer: ReturnType<typeof setTimeout>   | null = null;

  // Bound socket handlers — stored for clean removal in stop()

  queues: JamModeQueues = { loud: [], visual: [], note: [], ticker: [] };
  layout: LayoutName    = 'IDLE';
  slots:  SlotAssignment = {};

  constructor(pool: PoolManager) {
    super();
    this.pool              = pool;
    const cfg              = getJamConfig().jamMode;
    this.enrichIntervalMs  = cfg.enrichCheckMs;
    this.qrIntervalMs      = cfg.qrIntervalMs;
    this.qrHoldMs          = cfg.qrHoldMs;
    this.slotTimer      = new SlotTimer(cfg, (slot) => this.onSlotExpired(slot));
    this.lowerThird     = new LowerThirdOrchestrator((event, payload) => this.io.emit(event, payload));
    this.slotChyron     = new SlotChyronOrchestrator((event, payload) => this.io.emit(event, payload));
    this.enrichPoller = new EnrichmentPoller(
      cfg.enrichCheckMs,
      () => {
        this.queues = this.fetchQueues();
        if (this.queues.visual.length > 0 || this.queues.note.length > 0) {
          this.applyLayout();
          return true;
        }
        return false;
      },
      (checkAt) => {
        // Called each time a check is programmed (initial schedule + reschedule).
        this.io.emit('jam-mode:enrich', { checkAt, intervalMs: this.enrichIntervalMs });
      },
    );
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  load(_signal: AbortSignal): void {
    this.queues = this.fetchQueues();
  }

  play(): void {
    this.applyLayout();
    this.qrTimer = setInterval(() => {
      this.qrForced = true;
      this.applyLayout();
      this.qrHoldTimer = setTimeout(() => {
        this.qrForced = false;
        this.queues = this.fetchQueues();
        this.applyLayout();
      }, this.qrHoldMs);
    }, this.qrIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.qrTimer)     clearInterval(this.qrTimer);
    if (this.qrHoldTimer) clearTimeout(this.qrHoldTimer);
    this.qrTimer     = null;
    this.qrHoldTimer = null;
    this.qrForced    = false;
    this.slotTimer.clearAll();
    this.enrichPoller.cancel();
    this.lowerThird.clear();
    this.slotChyron.clear();
  }

  remove(): void {
    this.queues = { loud: [], visual: [], note: [], ticker: [] };
  }

  // ─── State (HTTP polling / reconnect) ────────────────────────────────────────

  override getState(): {
    layout:      LayoutName;
    slots:       SlotAssignment;
    timing:      Partial<Record<SlotName, SlotTimerMeta>>;
    lowerThird:   LowerThirdPayload | null;
    slotChyron:   SlotChyronPayload | null;
    enrichCheckAt: { checkAt: number; intervalMs: number } | null;
    qrVisible:   boolean;
  } {
    const timing: Partial<Record<SlotName, SlotTimerMeta>> = {};
    for (const slot of ['loud', 'visual', 'note'] as SlotName[]) {
      const m = this.slotTimer.getMeta(slot);
      if (m) timing[slot] = m;
    }
    return {
      layout:        this.layout,
      slots:         this.slots,
      timing,
      lowerThird:    this.lowerThird.getPayload(),
      slotChyron:    this.slotChyron.getPayload(),
      enrichCheckAt: this.enrichPoller.getCheckAt() != null
      ? { checkAt: this.enrichPoller.getCheckAt()!, intervalMs: this.enrichIntervalMs }
      : null,
      qrVisible:     this.qrForced,
    };
  }

  // ─── Pool delegation ─────────────────────────────────────────────────────────

  onPoolUpdate(_item: MediaItem): void {
    this.queues = this.fetchQueues();
    if (this.layout === 'IDLE') this.applyLayout();
  }

  // ─── Admin controls ──────────────────────────────────────────────────────────

  skipSlot(slot: SlotName): boolean {
    const current = this.slots[slot];
    if (!current) return false;
    this.pool.markDisplayed(current.id, this.id);
    this.slotTimer.clear(slot);
    this.queues = this.fetchQueues();
    this.applyLayout();
    return true;
  }

  reResolveLayout(): void {
    this.slotTimer.clearAll();
    this.enrichPoller.cancel();
    this.queues = this.fetchQueues();
    this.applyLayout();
  }

  // ─── Core layout cycle ───────────────────────────────────────────────────────

  private applyLayout(): void {
    if (this.qrForced) {
      this.layout = 'QR_CARD';
      this.io.emit('jam-mode:layout', { layout: 'QR_CARD', slots: {}, timing: {} });
      this.lowerThird.clear();
      this.slotChyron.clear();
      this.enrichPoller.cancel();
      this.io.emit('jam-mode:enrich', null);
      return;
    }

    const prevSlots = this.slots;

    const locked = {
      loud:   this.slotTimer.getMeta('loud')   !== undefined && this.queues.loud.length   > 0,
      visual: this.slotTimer.getMeta('visual') !== undefined && this.queues.visual.length > 0,
      note:   this.slotTimer.getMeta('note')   !== undefined && this.queues.note.length   > 0,
    };

    this.layout = resolveLayout(this.queues, locked);
    this.slots  = assignSlots(this.layout, this.queues);

    this.rescheduleTimers(prevSlots, this.slots);

    const timing: Partial<Record<SlotName, SlotTimerMeta>> = {};
    for (const slot of ['loud', 'visual', 'note'] as SlotName[]) {
      const m = this.slotTimer.getMeta(slot);
      if (m) timing[slot] = m;
    }

    this.enrichPoller.cancel();
    if (this.slots.loud && !this.slots.visual && !this.slots.note) {
      this.enrichPoller.schedule(); // onScheduled callback emits jam-mode:enrich { checkAt }
    } else {
      this.io.emit('jam-mode:enrich', null); // enrichment not applicable for this layout
    }

    this.io.emit('jam-mode:layout', { layout: this.layout, slots: this.slots, timing });

    this.lowerThird.update(this.layout, this.slots);
    this.slotChyron.update(this.layout, this.slots);
  }

  private onSlotExpired(slot: SlotName): void {
    const current = this.slots[slot];
    if (current) this.pool.markDisplayed(current.id, this.id);
    this.queues = this.fetchQueues();
    this.applyLayout();
  }

  private rescheduleTimers(prev: SlotAssignment, next: SlotAssignment): void {
    for (const slot of ['loud', 'visual', 'note'] as SlotName[]) {
      const prevItem = prev[slot];
      const nextItem = next[slot];
      if (nextItem === undefined) {
        this.slotTimer.clear(slot);
      } else if (nextItem.id !== prevItem?.id) {
        this.slotTimer.schedule(slot, nextItem);
      }
    }
  }

  private fetchQueues(): JamModeQueues {
    return {
      loud:   this.pool.getMain({ types: ['youtube', 'clip'] }),
      visual: this.pool.getMain({ types: ['photo', 'gif', 'giphy'] }),
      note:   this.pool.getMain({ types: ['note'] }),
      ticker: this.pool.getMain({ types: ['ticker'] }),
    };
  }
}