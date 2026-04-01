// LowerThirdOrchestrator — manages show/hide/reattribution of the lower-third.
//
// Receives layout + slots after each resolution, determines the attributable item,
// and emits socket events at the right moments.
// The broadcast client only reacts — no timing logic lives there.

import type { LayoutName, MediaItem, YoutubeContent } from '@shared/types';
import type { SlotAssignment } from './layout-engine.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LowerThirdPayload {
  label: string;
  name:  string;
  role:  string;
}

type EmitFn = (event: string, payload?: unknown) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTRIBUTION_HOLD_MS       = 6_000;
const REATTRIBUTION_INTERVAL_MS = 90_000;
const REATTRIBUTION_HOLD_MS     = 4_000;

const LAYOUTS_WITH_LT = new Set<LayoutName>([
  'VISUAL_FULL',
  'MEDIA_FULL',
  'MEDIA_WITH_VISUAL',
  'DUAL_VISUAL',
]);

const TYPE_LABELS: Partial<Record<MediaItem['type'], string>> = {
  youtube:   'Vidéo',
  clip:      'Clip',
  photo:     'Photo',
  gif:       'GIF',
  giphy:     'GIF',
  note:      'Note',
  link:      'Lien',
  interview: 'Interview',
};

// ─── LowerThirdOrchestrator ───────────────────────────────────────────────────

export class LowerThirdOrchestrator {
  private readonly emit: EmitFn;

  private itemId:     string | undefined;
  private payload:    LowerThirdPayload | null = null;
  private hideTimer:  ReturnType<typeof setTimeout> | undefined;
  private reattTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(emit: EmitFn) {
    this.emit = emit;
  }

  // Called after every layout resolution.
  update(layout: LayoutName, slots: SlotAssignment): void {
    const item = this.itemFor(layout, slots);
    if (!item) {
      this.clear();
      return;
    }
    if (item.id !== this.itemId) {
      this.itemId = item.id;
      this.clearTimers();
      this.show(item, ATTRIBUTION_HOLD_MS);
    }
  }

  // Returns current payload for reconnect state (included in getState()).
  getPayload(): LowerThirdPayload | null {
    return this.payload;
  }

  clear(): void {
    if (this.itemId !== undefined || this.payload !== null) {
      this.itemId  = undefined;
      this.payload = null;
      this.emit('jam-mode:lower-third:hide');
    }
    this.clearTimers();
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private itemFor(layout: LayoutName, slots: SlotAssignment): MediaItem | undefined {
    if (!LAYOUTS_WITH_LT.has(layout)) return undefined;
    return layout === 'MEDIA_FULL' ? slots.loud : slots.visual;
  }

  private show(item: MediaItem, holdMs: number): void {
    this.payload = this.payloadFor(item);
    this.emit('jam-mode:lower-third:show', this.payload);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      this.payload   = null;
      this.emit('jam-mode:lower-third:hide');
      this.scheduleReattribution(item);
    }, holdMs);
  }

  private scheduleReattribution(item: MediaItem): void {
    clearTimeout(this.reattTimer);
    this.reattTimer = setTimeout(() => {
      this.reattTimer = undefined;
      if (item.id === this.itemId) {
        this.show(item, REATTRIBUTION_HOLD_MS);
      }
    }, REATTRIBUTION_INTERVAL_MS);
  }

  private clearTimers(): void {
    clearTimeout(this.hideTimer);
    clearTimeout(this.reattTimer);
    this.hideTimer  = undefined;
    this.reattTimer = undefined;
  }

  private payloadFor(item: MediaItem): LowerThirdPayload {
    const label = TYPE_LABELS[item.type] ?? item.type;
    if (item.type === 'youtube') {
      return {
        label,
        name: (item.content as YoutubeContent).title,
        role: `Envoyé par ${item.author.displayName}`,
      };
    }
    return { label, name: item.author.displayName, role: item.author.role ?? '' };
  }
}
