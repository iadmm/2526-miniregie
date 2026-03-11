import { describe, it, expect } from 'vitest';
import { validateJamTransition } from './jam-state.js';

describe('validateJamTransition — allowed', () => {
  it('idle → running (JAM_START)', () => {
    expect(validateJamTransition('idle', 'running').ok).toBe(true);
  });

  it('running → ended (JAM_END)', () => {
    expect(validateJamTransition('running', 'ended').ok).toBe(true);
  });
});

describe('validateJamTransition — forbidden', () => {
  it('idle → ended', () => {
    const result = validateJamTransition('idle', 'ended');
    expect(result.ok).toBe(false);
  });

  it('running → idle', () => {
    const result = validateJamTransition('running', 'idle');
    expect(result.ok).toBe(false);
  });

  it('ended → idle', () => {
    const result = validateJamTransition('ended', 'idle');
    expect(result.ok).toBe(false);
  });

  it('ended → running', () => {
    const result = validateJamTransition('ended', 'running');
    expect(result.ok).toBe(false);
  });
});

describe('validateJamTransition — same state (double trigger)', () => {
  it('idle → idle returns ok: false with a warning-friendly message', () => {
    const result = validateJamTransition('idle', 'idle');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already/i);
  });

  it('running → running returns ok: false', () => {
    const result = validateJamTransition('running', 'running');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already/i);
  });

  it('ended → ended returns ok: false', () => {
    const result = validateJamTransition('ended', 'ended');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already/i);
  });
});
