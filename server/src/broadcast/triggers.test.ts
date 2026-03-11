import { describe, it, expect } from 'vitest';
import { shouldFire, parseScheduleEntry } from './triggers.js';

const MIN  = 60_000;
const HOUR = 60 * MIN;

// ─── shouldFire ───────────────────────────────────────────────────────────────

describe('shouldFire — H+', () => {
  it('fires when now >= startedAt + value', () => {
    const startedAt = 1_000_000;
    const result = shouldFire(
      { at: 'H+', value: 10 * MIN },
      { startedAt, endsAt: null },
      startedAt + 10 * MIN,
    );
    expect(result).toBe(true);
  });

  it('fires when past the threshold', () => {
    const startedAt = 1_000_000;
    const result = shouldFire(
      { at: 'H+', value: 10 * MIN },
      { startedAt, endsAt: null },
      startedAt + 11 * MIN,
    );
    expect(result).toBe(true);
  });

  it('does not fire before the threshold', () => {
    const startedAt = 1_000_000;
    const result = shouldFire(
      { at: 'H+', value: 10 * MIN },
      { startedAt, endsAt: null },
      startedAt + 9 * MIN,
    );
    expect(result).toBe(false);
  });

  it('returns false when startedAt is null', () => {
    const result = shouldFire(
      { at: 'H+', value: 10 * MIN },
      { startedAt: null, endsAt: null },
      Date.now(),
    );
    expect(result).toBe(false);
  });


});

describe('shouldFire — T-', () => {
  it('fires when now >= endsAt - value', () => {
    const endsAt = 10_000_000;
    const result = shouldFire(
      { at: 'T-', value: 4 * HOUR },
      { startedAt: null, endsAt },
      endsAt - 4 * HOUR,
    );
    expect(result).toBe(true);
  });

  it('fires when past the threshold', () => {
    const endsAt = 10_000_000;
    const result = shouldFire(
      { at: 'T-', value: 4 * HOUR },
      { startedAt: null, endsAt },
      endsAt - 3 * HOUR,
    );
    expect(result).toBe(true);
  });

  it('does not fire before the threshold', () => {
    const endsAt = 10_000_000;
    const result = shouldFire(
      { at: 'T-', value: 4 * HOUR },
      { startedAt: null, endsAt },
      endsAt - 5 * HOUR,
    );
    expect(result).toBe(false);
  });

  it('returns false when endsAt is null', () => {
    const result = shouldFire(
      { at: 'T-', value: 4 * HOUR },
      { startedAt: null, endsAt: null },
      Date.now(),
    );
    expect(result).toBe(false);
  });


});

describe('shouldFire — absolute', () => {
  it('fires when now >= the absolute timestamp', () => {
    const value = '2026-03-01T09:00:00.000Z';
    const result = shouldFire(
      { at: 'absolute', value },
      { startedAt: null, endsAt: null },
      Date.parse(value),
    );
    expect(result).toBe(true);
  });

  it('fires when past the absolute timestamp', () => {
    const value = '2026-03-01T09:00:00.000Z';
    const result = shouldFire(
      { at: 'absolute', value },
      { startedAt: null, endsAt: null },
      Date.parse(value) + 1000,
    );
    expect(result).toBe(true);
  });

  it('does not fire before the absolute timestamp', () => {
    const value = '2026-03-01T09:00:00.000Z';
    const result = shouldFire(
      { at: 'absolute', value },
      { startedAt: null, endsAt: null },
      Date.parse(value) - 1000,
    );
    expect(result).toBe(false);
  });
});

// ─── parseScheduleEntry ───────────────────────────────────────────────────────

describe('parseScheduleEntry', () => {
  it('parses H+HH:MM:SS', () => {
    expect(parseScheduleEntry('H+00:10:00')).toEqual({ at: 'H+', value: 10 * MIN });
    expect(parseScheduleEntry('H+12:00:00')).toEqual({ at: 'H+', value: 12 * HOUR });
    expect(parseScheduleEntry('H+30:00:00')).toEqual({ at: 'H+', value: 30 * HOUR });
  });

  it('parses T-HH:MM:SS', () => {
    expect(parseScheduleEntry('T-04:00:00')).toEqual({ at: 'T-', value: 4 * HOUR });
    expect(parseScheduleEntry('T-01:00:00')).toEqual({ at: 'T-', value: 1 * HOUR });
  });

  it('parses absolute ISO timestamp', () => {
    expect(parseScheduleEntry('2026-03-01T09:00:00')).toEqual({ at: 'absolute', value: '2026-03-01T09:00:00' });
  });

  it('throws on unrecognized format', () => {
    expect(() => parseScheduleEntry('H+00:05:00_after_end')).toThrow();
    expect(() => parseScheduleEntry('invalid')).toThrow();
  });

  it('throws on JAM_START — it is a market trigger, not a schedule entry', () => {
    expect(() => parseScheduleEntry('JAM_START')).toThrow();
  });

  it('throws on JAM_END — use an absolute timestamp instead', () => {
    expect(() => parseScheduleEntry('JAM_END')).toThrow();
  });
});
