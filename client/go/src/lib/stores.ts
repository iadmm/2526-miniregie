import type { Participant } from '@shared/types.js';

// Global participant state using Svelte 5 runes.
// Exported as a plain $state so components can read and mutate it directly.
export const participantState = $state<{ value: Participant | null }>({ value: null });