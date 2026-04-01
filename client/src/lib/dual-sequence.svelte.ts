// dual-sequence.svelte.ts — Client-side state machine for DUAL_VISUAL / PORTRAIT_DUO.
//
// When a dual layout arrives, each visual gets a solo moment with its own lower-third
// (caption-first) before the two images glide side by side.
//
// Phases:
//   idle     — no dual sequence active
//   first    — visual1 full-screen, lower-third for visual1
//   second   — visual2 full-screen, lower-third for visual2
//   together — normal side-by-side layout, visuals animate to their positions

import type { LayoutName, MediaItem } from '@shared/types';

const DUAL_SOLO_MS = 5_000;

export type DualPhase = 'idle' | 'first' | 'second' | 'together';

interface LowerThirdLike {
  label: string;
  name:  string;
  role:  string;
}

interface DualSequenceState {
  phase:       DualPhase;
  layout:      LayoutName | null;
  visual1:     MediaItem | null;
  visual2:     MediaItem | null;
  lowerThird:  LowerThirdLike | null;
}

export const dualSequence = $state<DualSequenceState>({
  phase:      'idle',
  layout:     null,
  visual1:    null,
  visual2:    null,
  lowerThird: null,
});

let soloTimer: ReturnType<typeof setTimeout> | undefined;

export function startDualSequence(layout: LayoutName, v1: MediaItem, v2: MediaItem): void {
  // Same items already in sequence — do not restart
  if (
    dualSequence.visual1?.id === v1.id &&
    dualSequence.visual2?.id === v2.id &&
    dualSequence.phase !== 'idle'
  ) return;
  clearTimeout(soloTimer);
  dualSequence.layout     = layout;
  dualSequence.visual1    = v1;
  dualSequence.visual2    = v2;
  dualSequence.phase      = 'first';
  dualSequence.lowerThird = buildLowerThird(v1);
  soloTimer = setTimeout(() => {
    dualSequence.phase      = 'second';
    dualSequence.lowerThird = buildLowerThird(v2);
    soloTimer = setTimeout(() => {
      dualSequence.phase      = 'together';
      dualSequence.lowerThird = null;
    }, DUAL_SOLO_MS);
  }, DUAL_SOLO_MS);
}

// Set together state directly (used on reconnect — skip the intro)
export function resumeDualTogether(layout: LayoutName, v1: MediaItem, v2: MediaItem): void {
  clearTimeout(soloTimer);
  soloTimer           = undefined;
  dualSequence.layout     = layout;
  dualSequence.visual1    = v1;
  dualSequence.visual2    = v2;
  dualSequence.phase      = 'together';
  dualSequence.lowerThird = null;
}

export function clearDual(): void {
  clearTimeout(soloTimer);
  soloTimer               = undefined;
  dualSequence.phase      = 'idle';
  dualSequence.layout     = null;
  dualSequence.visual1    = null;
  dualSequence.visual2    = null;
  dualSequence.lowerThird = null;
}

const TYPE_LABELS: Partial<Record<string, string>> = {
  photo: 'Photo',
  gif:   'GIF',
  giphy: 'GIF',
  link:  'Lien',
};

function buildLowerThird(item: MediaItem): LowerThirdLike {
  const label   = TYPE_LABELS[item.type] ?? item.type;
  const caption = (item.content as { caption?: string | null }).caption;
  if (caption) return { label, name: caption, role: item.author.displayName };
  return { label, name: item.author.displayName, role: item.author.role ?? '' };
}
