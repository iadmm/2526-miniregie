import type { LayoutName, MediaItem } from "@shared/types";

// ─── Layout requirements ──────────────────────────────────────────────────────
//
// Each layout is fully described by the number of slots it requires.
// loud  = youtube or clip
// visual = photo or gif  (slot #js-slot-visual, or both slots when dual:true)
// note  = note           (slot #js-slot-caption)
//
// DUAL_VISUAL reuses the caption slot for a second visual (dual: true).

export interface LayoutRequirements {
  loud:   0 | 1;
  visual: 0 | 1 | 2; // 2 only for DUAL_VISUAL
  note:   0 | 1;
  dual?:  true;       // caption slot holds a second visual instead of a note
  // Selection weight: higher = preferred when multiple layouts are eligible.
  // Layouts with loud are always weighted above purely silent ones (weight ≥ 50).
  weight: number;
}

export const LAYOUT_REQUIREMENTS: Record<LayoutName, LayoutRequirements> = {
  //                                                           weight
  IDLE:                 { loud: 0, visual: 0, note: 0,        weight:  0 },
  NOTE_CARD:            { loud: 0, visual: 0, note: 1,        weight: 10 },
  VISUAL_FULL:          { loud: 0, visual: 1, note: 0,        weight: 25 },
  VISUAL_WITH_CAPTION:  { loud: 0, visual: 1, note: 1,        weight: 35 },
  DUAL_VISUAL:          { loud: 0, visual: 2, note: 0, dual: true, weight: 40 },
  MEDIA_FULL:           { loud: 1, visual: 0, note: 0,        weight: 50 },
  MEDIA_WITH_CAPTION:   { loud: 1, visual: 0, note: 1,        weight: 60 },
  MEDIA_WITH_VISUAL:    { loud: 1, visual: 1, note: 0,        weight: 65 },
  MEDIA_VIS_CAP:        { loud: 1, visual: 1, note: 1,        weight: 80 },
};

// ─── Queues input ─────────────────────────────────────────────────────────────

export interface LayoutQueues {
  loud:   MediaItem[]; // youtube | clip
  visual: MediaItem[]; // photo | gif
  note:   MediaItem[]; // note
}

// ─── resolveLayout ────────────────────────────────────────────────────────────
//
// 1. Filters layouts whose slot requirements are satisfied by available items.
// 2. Locked slots (active timer still running) constrain the eligible set:
//    a locked slot must be present in the chosen layout.
// 3. Picks a random layout with probability proportional to weight.
//    IDLE (weight 0) is only returned when no other layout is eligible.

export interface LayoutLocks {
  loud?:   boolean;
  visual?: boolean;
  note?:   boolean;
}

export function resolveLayout(queues: LayoutQueues, locked: LayoutLocks = {}): LayoutName {
  const available = {
    loud:   queues.loud.length,
    visual: queues.visual.length,
    note:   queues.note.length,
  };

  const eligible = (Object.entries(LAYOUT_REQUIREMENTS) as [LayoutName, LayoutRequirements][])
    .filter(([, req]) =>
      req.loud   <= available.loud   &&
      req.visual <= available.visual &&
      req.note   <= available.note   &&
      // A locked slot must be included in the new layout
      (!locked.loud   || req.loud   >= 1) &&
      (!locked.visual || req.visual >= 1) &&
      (!locked.note   || req.note   >= 1),
    );

  const totalWeight = eligible.reduce((sum, [, req]) => sum + req.weight, 0);

  // All queues empty — only IDLE qualifies
  if (totalWeight === 0) return 'IDLE';

  let cursor = Math.random() * totalWeight;
  for (const [name, req] of eligible) {
    cursor -= req.weight;
    if (cursor <= 0) return name;
  }

  // Fallback (floating-point edge case)
  return eligible.at(-1)![0];
}

// ─── assignSlots ──────────────────────────────────────────────────────────────
//
// Given a resolved layout and the current queues, picks which items fill each slot.
// visual2 is only set for DUAL_VISUAL (second visual in the caption slot).

export interface SlotAssignment {
  loud?:    MediaItem;
  visual?:  MediaItem;
  visual2?: MediaItem;
  note?:    MediaItem;
}

export function assignSlots(layout: LayoutName, queues: LayoutQueues): SlotAssignment {
  const req    = LAYOUT_REQUIREMENTS[layout];
  const result: SlotAssignment = {};
  // Non-null assertions are safe: resolveLayout only selects a layout when
  // req.X <= queue.length, so queue[0]/[1] are always defined here.
  if (req.loud   >= 1) result.loud    = queues.loud[0]!;
  if (req.visual >= 1) result.visual  = queues.visual[0]!;
  if (req.visual >= 2) result.visual2 = queues.visual[1]!;
  if (req.note   >= 1) result.note    = queues.note[0]!;
  return result;
}
