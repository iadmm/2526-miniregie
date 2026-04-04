import type { LayoutName, MediaItem } from "@shared/types";

// ─── Aspect ratio thresholds ──────────────────────────────────────────────────
//
// Portrait:  AR < PORTRAIT_MAX  (9:16 ≈ 0.56, 3:4 = 0.75)
// Wide:      AR > WIDE_MIN      (21:9 ≈ 2.33, panoramas)
// Standard:  everything in between

export const PORTRAIT_MAX = 0.80; // < this = portrait
export const WIDE_MIN     = 1.80; // > this = wide / panoramic

// ─── Layout requirements ──────────────────────────────────────────────────────
//
// loud   = youtube or clip        (#js-slot-yt)
// visual = photo or gif           (#js-slot-visual)
// note   = note                   (#js-slot-caption)
// dual   = caption slot holds a second visual instead of a note (DUAL_VISUAL, PORTRAIT_DUO)
//
// aspectProfile — if present, the layout's weight is multiplied by an AR-fit
// factor (×3 when content matches, ×0.15 when it doesn't, ×1 when AR is null).
// Layouts without a profile are AR-neutral and always use their base weight.

export interface AspectRange {
  min?: number;
  max?: number;
}

export interface AspectProfile {
  loud?:   AspectRange;
  visual?: AspectRange;
}

export interface LayoutRequirements {
  loud:           0 | 1;
  visual:         0 | 1 | 2; // 2 = DUAL_VISUAL / PORTRAIT_DUO (uses caption slot)
  note:           0 | 1;
  dual?:          true;       // caption slot holds visual2 instead of a note
  weight:         number;     // base weight for random selection
  aspectProfile?: AspectProfile;
}

export const LAYOUT_REQUIREMENTS: Record<LayoutName, LayoutRequirements> = {
  // ── Aspect-neutral layouts ─────────────────────────────────────────────────
  //                                                                     weight
  IDLE:                      { loud: 0, visual: 0, note: 0,             weight:  0 },
  QR_CARD:                   { loud: 0, visual: 0, note: 0,             weight:  0 },
  NOTE_CARD:                 { loud: 0, visual: 0, note: 1,             weight: 10 },
  VISUAL_FULL:               { loud: 0, visual: 1, note: 0,             weight: 25 },
  VISUAL_WITH_CAPTION:       { loud: 0, visual: 1, note: 1,             weight: 35 },
  DUAL_VISUAL:               { loud: 0, visual: 2, note: 0, dual: true, weight: 40 },
  MEDIA_FULL:                { loud: 1, visual: 0, note: 0,             weight: 50 },
  MEDIA_WITH_CAPTION:        { loud: 1, visual: 0, note: 1,             weight: 60 },
  MEDIA_WITH_VISUAL:         { loud: 1, visual: 1, note: 0,             weight: 65 },

  // ── Portrait visual (AR < PORTRAIT_MAX) ───────────────────────────────────
  //
  // Base weights are intentionally below their neutral counterparts.
  // With the ×3 boost they clearly win when portrait content is available;
  // with the ×0.15 penalty they are nearly invisible for landscape content.
  PORTRAIT_FULL:             { loud: 0, visual: 1, note: 0,             weight: 20,
                               aspectProfile: { visual: { max: PORTRAIT_MAX } } },
  PORTRAIT_DUO:              { loud: 0, visual: 2, note: 0, dual: true, weight: 35,
                               aspectProfile: { visual: { max: PORTRAIT_MAX } } },
  PORTRAIT_WITH_NOTE:        { loud: 0, visual: 1, note: 1,             weight: 28,
                               aspectProfile: { visual: { max: PORTRAIT_MAX } } },

  // ── Vertical media (AR < PORTRAIT_MAX on the loud slot) ───────────────────
  VERTICAL_MEDIA:            { loud: 1, visual: 0, note: 0,             weight: 45,
                               aspectProfile: { loud: { max: PORTRAIT_MAX } } },
  VERTICAL_MEDIA_WITH_NOTE:  { loud: 1, visual: 0, note: 1,             weight: 55,
                               aspectProfile: { loud: { max: PORTRAIT_MAX } } },

  // ── Wide / panoramic (AR > WIDE_MIN) ──────────────────────────────────────
  WIDE_VISUAL:               { loud: 0, visual: 1, note: 0,             weight: 22,
                               aspectProfile: { visual: { min: WIDE_MIN } } },
  WIDE_VISUAL_WITH_NOTE:     { loud: 0, visual: 1, note: 1,             weight: 30,
                               aspectProfile: { visual: { min: WIDE_MIN } } },
};

// ─── Aspect ratio helpers ─────────────────────────────────────────────────────

function extractAR(item: MediaItem | undefined): number | null {
  if (!item) return null;
  const c = item.content as unknown as Record<string, unknown>;
  const ar = c['aspectRatio'];
  return typeof ar === 'number' && ar > 0 ? ar : null;
}

function arFit(ar: number | null, range: AspectRange): number {
  if (ar === null) return 0; // unknown AR → never pick an aspect-specific layout
  const inRange = (range.min === undefined || ar >= range.min)
               && (range.max === undefined || ar <= range.max);
  return inRange ? 3.0 : 0; // known mismatch → never selected
}

function effectiveWeight(
  req:      LayoutRequirements,
  loudAR:   number | null,
  visualAR: number | null,
): number {
  if (!req.aspectProfile) return req.weight;
  let multiplier = 1.0;
  if (req.aspectProfile.loud)   multiplier *= arFit(loudAR,   req.aspectProfile.loud);
  if (req.aspectProfile.visual) multiplier *= arFit(visualAR, req.aspectProfile.visual);
  return req.weight * multiplier;
}

// ─── Queues input ─────────────────────────────────────────────────────────────

export interface LayoutQueues {
  loud:   MediaItem[]; // youtube | clip
  visual: MediaItem[]; // photo | gif | giphy
  note:   MediaItem[]; // note
}

// ─── resolveLayout ────────────────────────────────────────────────────────────
//
// 1. Filters layouts whose slot requirements are satisfied by available items.
// 2. Locked slots constrain the eligible set: a locked slot must appear in the
//    chosen layout.
// 3. Computes an effective weight per layout: base weight × AR-fit multiplier
//    (derived from the top item in each queue).
// 4. Picks a layout at random with probability proportional to effective weight.
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

  // Aspect ratios of the top item in each queue
  const loudAR   = extractAR(queues.loud[0]);
  const visualAR = extractAR(queues.visual[0]);

  const eligible = (Object.entries(LAYOUT_REQUIREMENTS) as [LayoutName, LayoutRequirements][])
    .filter(([, req]) =>
      req.loud   <= available.loud   &&
      req.visual <= available.visual &&
      req.note   <= available.note   &&
      (!locked.loud   || req.loud   >= 1) &&
      (!locked.visual || req.visual >= 1) &&
      (!locked.note   || req.note   >= 1),
    );

  const weighted = eligible.map(([name, req]) => ({
    name,
    w: effectiveWeight(req, loudAR, visualAR),
  }));

  const totalWeight = weighted.reduce((sum, { w }) => sum + w, 0);

  if (totalWeight === 0) return 'IDLE';

  let cursor = Math.random() * totalWeight;
  for (const { name, w } of weighted) {
    cursor -= w;
    if (cursor <= 0) return name;
  }

  return weighted.at(-1)!.name;
}

// ─── assignSlots ──────────────────────────────────────────────────────────────
//
// Given a resolved layout and the current queues, picks which items fill each slot.
// visual2 is only set when req.visual >= 2 (DUAL_VISUAL, PORTRAIT_DUO).

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