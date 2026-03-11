import type { JamStatus } from '../../../shared/types.js';

const RATE_LIMIT_MS = 30_000;
const SYSTEM_IDS = new Set(['system:admin', 'system:narrator']);

export interface GuardContext {
  jamStatus:        JamStatus;
  participantId:    string;
  lastSubmissionAt: number | null;
  now?:             number;
}

export type GuardResult = { ok: true } | { ok: false; error: string };

export function guard({ jamStatus, participantId, lastSubmissionAt, now = Date.now() }: GuardContext): GuardResult {
  if (SYSTEM_IDS.has(participantId)) return { ok: true };

  if (jamStatus === 'idle')  return { ok: false, error: 'JAM not started yet' };
  if (jamStatus === 'ended') return { ok: false, error: 'JAM is over' };

  if (lastSubmissionAt !== null && now - lastSubmissionAt < RATE_LIMIT_MS) {
    return { ok: false, error: 'Too fast — wait 30s between submissions' };
  }

  return { ok: true };
}
