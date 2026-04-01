// SlotChyronOrchestrator — source tag for companion visual slots.
//
// Fires when the visual slot is a companion to an active loud (MEDIA_WITH_VISUAL,
// MEDIA_VIS_CAP). Unlike the lower-third, the chyron carries no hide timer —
// it stays visible for the full duration of the companion visual (source
// accountability, cf. Al Jazeera / Reuters B-roll tagging practice).
//
// Design: two-part tag mirroring the lower-third, miniaturised.
//   [PHOTO] [Martin Dupont]
//   ↑ #1ac0d7 flag, Schibsted Grotesk 700
//            ↑ #f8f7f5 bloc, Fraunces 400
// Positioned bottom-left of the visual slot, 5% inset.
// Entry: clip-path wipe, 160ms power2.out.

import type { LayoutName, MediaItem } from '@shared/types';
import type { SlotAssignment } from './layout-engine.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotChyronPayload {
  label:       string;          // "PHOTO" | "GIF" | "CLIP"
  name:        string;          // author display name
  caption?:    string;          // image caption if provided
  submittedAt: number;          // timestamp ms — for time display
}

type EmitFn = (event: string, payload?: unknown) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYOUTS_WITH_CHYRON = new Set<LayoutName>([
  'MEDIA_WITH_VISUAL',
]);

const TYPE_LABELS: Partial<Record<MediaItem['type'], string>> = {
  photo: 'PHOTO',
  gif:   'GIF',
  giphy: 'GIF',
  clip:  'CLIP',
};

// ─── SlotChyronOrchestrator ───────────────────────────────────────────────────

export class SlotChyronOrchestrator {
  private readonly emit: EmitFn;

  private itemId:  string | undefined;
  private payload: SlotChyronPayload | null = null;

  constructor(emit: EmitFn) {
    this.emit = emit;
  }

  // Called after every layout resolution.
  update(layout: LayoutName, slots: SlotAssignment): void {
    const item = LAYOUTS_WITH_CHYRON.has(layout) ? slots.visual : undefined;
    if (!item) {
      this.clear();
      return;
    }
    if (item.id !== this.itemId) {
      this.itemId = item.id;
      const caption = (item.content as { caption?: string | null }).caption ?? undefined;
      this.payload = {
        label:       TYPE_LABELS[item.type] ?? item.type.toUpperCase(),
        name:        item.author.displayName,
        caption,
        submittedAt: item.submittedAt,
      };
      this.emit('jam-mode:slot-chyron:show', this.payload);
    }
  }

  // Returns current payload for reconnect state (included in getState()).
  getPayload(): SlotChyronPayload | null {
    return this.payload;
  }

  clear(): void {
    if (this.itemId !== undefined || this.payload !== null) {
      this.itemId  = undefined;
      this.payload = null;
      this.emit('jam-mode:slot-chyron:hide');
    }
  }
}