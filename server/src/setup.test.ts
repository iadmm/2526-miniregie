import { describe, it, expect } from 'vitest';

// Ce test n'a qu'un seul rôle : valider que Vitest tourne.
// Il sera remplacé par scoring.test.ts en Phase 2.
describe('setup', () => {
  it('vitest fonctionne', () => {
    expect(1 + 1).toBe(2);
  });
});
