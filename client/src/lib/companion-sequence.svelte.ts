// companion-sequence.svelte.ts — Client-side state machine for companion visual intro.
//
// When a new companion visual arrives (MEDIA_WITH_VISUAL layout), the visual fills
// the screen while the loud plays audio-only. After COMPANION_INTRO_MS, the chyron
// hides and the visual glides to its companion position (COMPANION_SLIDE_MS).
//
// Phases:
//   idle    — no companion sequence active
//   intro   — visual full-screen, loud hidden, slot chyron visible
//   sliding — chyron gone, visual animating to companion position
//   active  — normal companion layout, loud visible

import type { MediaItem } from '@shared/types';

const COMPANION_INTRO_MS = 3_000;
const COMPANION_SLIDE_MS = 800;

export type CompanionPhase = 'idle' | 'intro' | 'sliding' | 'active';

interface CompanionSequenceState {
  phase:        CompanionPhase;
  visualItemId: string | null;
}

export const companionSequence = $state<CompanionSequenceState>({
  phase:        'idle',
  visualItemId: null,
});

export function isCompanionIntroActive(): boolean {
  return companionSequence.phase === 'intro' || companionSequence.phase === 'sliding';
}

let introTimer: ReturnType<typeof setTimeout> | undefined;
let slideTimer: ReturnType<typeof setTimeout> | undefined;

export function startCompanionIntro(visual: MediaItem): void {
  // Same visual already in intro or later phase — do not restart
  if (visual.id === companionSequence.visualItemId && companionSequence.phase !== 'idle') return;
  clearTimers();
  companionSequence.phase        = 'intro';
  companionSequence.visualItemId = visual.id;
  introTimer = setTimeout(() => {
    companionSequence.phase = 'sliding';
    slideTimer = setTimeout(() => {
      companionSequence.phase = 'active';
    }, COMPANION_SLIDE_MS);
  }, COMPANION_INTRO_MS);
}

// Set active state directly (used on reconnect — skip the intro)
export function resumeCompanionActive(visualItemId: string): void {
  clearTimers();
  companionSequence.phase        = 'active';
  companionSequence.visualItemId = visualItemId;
}

export function clearCompanion(): void {
  clearTimers();
  companionSequence.phase        = 'idle';
  companionSequence.visualItemId = null;
}

function clearTimers(): void {
  clearTimeout(introTimer);
  clearTimeout(slideTimer);
  introTimer = undefined;
  slideTimer = undefined;
}
