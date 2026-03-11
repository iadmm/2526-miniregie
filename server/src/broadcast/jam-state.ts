import type { JamStatus } from '@shared/types';

type TransitionResult = { ok: true } | { ok: false; error: string };

const ALLOWED = new Set(['idle→running', 'running→ended']);

export function validateJamTransition(from: JamStatus, to: JamStatus): TransitionResult {
  if (from === to) {
    return { ok: false, error: `JAM is already ${from}` };
  }
  if (!ALLOWED.has(`${from}→${to}`)) {
    return { ok: false, error: `Transition ${from} → ${to} is not allowed` };
  }
  return { ok: true };
}
