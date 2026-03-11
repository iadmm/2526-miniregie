import type { TimeCondition } from '../../../shared/types.js';

const MIN  = 60_000;
const HOUR = 60 * MIN;

interface JamTimes {
  startedAt: number | null;
  endsAt:    number | null;
}

export function shouldFire(condition: TimeCondition, jam: JamTimes, now: number = Date.now()): boolean {
  switch (condition.at) {
    case 'H+':
      return jam.startedAt !== null && now >= jam.startedAt + condition.value;
    case 'T-':
      return jam.endsAt !== null && now >= jam.endsAt - condition.value;
    case 'absolute':
      return now >= Date.parse(condition.value);
  }
}

function parseHHMMSS(raw: string): number {
  const match = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid HH:MM:SS format: ${raw}`);
  const [, h, m, s] = match.map(Number);
  return (h! * HOUR) + (m! * MIN) + (s! * 1000);
}

export function parseScheduleEntry(raw: string): TimeCondition {
  if (raw === 'JAM_START') throw new Error('JAM_START is a market trigger — use admin action, not schedule');
  if (raw === 'JAM_END')   throw new Error('JAM_END is ambiguous — use an absolute timestamp in schedule.json');

  if (raw.startsWith('H+')) return { at: 'H+', value: parseHHMMSS(raw.slice(2)) };
  if (raw.startsWith('T-')) return { at: 'T-', value: parseHHMMSS(raw.slice(2)) };
  if (!Number.isNaN(Date.parse(raw))) return { at: 'absolute', value: raw };

  throw new Error(`Unrecognized schedule entry format: ${raw}`);
}
