import { describe, it, expect } from 'vitest';
import { computeScore } from './scoring.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

// Helper — crée un item minimal pour le scoring
function item(overrides: { priority?: number; submittedAt?: number } = {}) {
  return {
    priority:    overrides.priority    ?? 100,
    submittedAt: overrides.submittedAt ?? Date.now(),
  };
}

describe('computeScore — freshnessScore', () => {
  it('< 2min → +80', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 1 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100 + 80);
  });

  it('< 15min → +30', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 5 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100 + 30);
  });

  it('< 1h → 0', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100);
  });

  it('> 1h → -50', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 2 * HOUR }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100 - 50);
  });

  it('exactement 2min → tiède (< 15min)', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 2 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100 + 30);
  });

  it('exactement 15min → froid (< 1h)', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 15 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100);
  });

  it('exactement 1h → glacial', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 1 * HOUR }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100 - 50);
  });
});

describe('computeScore — pénalités', () => {
  it('chaque affichage coûte 40 points', () => {
    const now = Date.now();
    const base = computeScore(item({ submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 0 }, now);
    const after3 = computeScore(item({ submittedAt: now - 30 * MIN }), { displayed: 3, skipped: 0 }, now);
    expect(after3).toBe(base - 3 * 40);
  });

  it('chaque skip coûte 120 points', () => {
    const now = Date.now();
    const base = computeScore(item({ submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 0 }, now);
    const after2 = computeScore(item({ submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 2 }, now);
    expect(after2).toBe(base - 2 * 120);
  });

  it('pénalités combinées', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 30 * MIN }), { displayed: 2, skipped: 1 }, now);
    expect(score).toBe(100 + 0 - 2 * 40 - 1 * 120);
  });

  it('le score peut être négatif', () => {
    const now = Date.now();
    const score = computeScore(item({ submittedAt: now - 2 * HOUR }), { displayed: 5, skipped: 3 }, now);
    expect(score).toBe(100 - 50 - 5 * 40 - 3 * 120);
    expect(score).toBeLessThan(0);
  });
});

describe('computeScore — priorités', () => {
  it('priorité standard = 100', () => {
    const now = Date.now();
    const score = computeScore(item({ priority: 100, submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(100);
  });

  it('interview priority = 200', () => {
    const now = Date.now();
    const score = computeScore(item({ priority: 200, submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(200);
  });

  it('item épinglé priority = 999', () => {
    const now = Date.now();
    const score = computeScore(item({ priority: 999, submittedAt: now - 2 * HOUR }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(999 - 50);
    // Un épinglé sans pénalités dépasse largement un standard neuf (100 + 80 = 180)
    expect(score).toBeGreaterThan(180);
  });

  it('ticker priority = 80', () => {
    const now = Date.now();
    const score = computeScore(item({ priority: 80, submittedAt: now - 30 * MIN }), { displayed: 0, skipped: 0 }, now);
    expect(score).toBe(80);
  });
});

describe('computeScore — now par défaut', () => {
  it('utilise Date.now() si now non fourni', () => {
    const i = item({ submittedAt: Date.now() - 30 * MIN });
    const withNow    = computeScore(i, { displayed: 0, skipped: 0 }, Date.now());
    const withoutNow = computeScore(i, { displayed: 0, skipped: 0 });
    // Même freshnessScore attendu (< 1h), différence négligeable
    expect(withoutNow).toBe(withNow);
  });
});
