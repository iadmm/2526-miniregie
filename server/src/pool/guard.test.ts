import { describe, it, expect } from 'vitest';
import { guard } from './guard.js';

const SEC = 1000;
const now = Date.now();

describe('guard — JAM status', () => {
  it('accepts submission when JAM is running', () => {
    const result = guard({ jamStatus: 'running', participantId: 'user-1', lastSubmissionAt: null, now });
    expect(result.ok).toBe(true);
  });

  it('rejects when JAM is idle', () => {
    const result = guard({ jamStatus: 'idle', participantId: 'user-1', lastSubmissionAt: null, now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not started/i);
  });

  it('rejects when JAM is ended', () => {
    const result = guard({ jamStatus: 'ended', participantId: 'user-1', lastSubmissionAt: null, now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/over/i);
  });
});

describe('guard — rate limit', () => {
  it('accepts first submission (no previous)', () => {
    const result = guard({ jamStatus: 'running', participantId: 'user-1', lastSubmissionAt: null, now });
    expect(result.ok).toBe(true);
  });

  it('accepts submission after 30s cooldown', () => {
    const result = guard({ jamStatus: 'running', participantId: 'user-1', lastSubmissionAt: now - 30 * SEC, now });
    expect(result.ok).toBe(true);
  });

  it('accepts submission after more than 30s', () => {
    const result = guard({ jamStatus: 'running', participantId: 'user-1', lastSubmissionAt: now - 60 * SEC, now });
    expect(result.ok).toBe(true);
  });

  it('rejects submission within 30s cooldown', () => {
    const result = guard({ jamStatus: 'running', participantId: 'user-1', lastSubmissionAt: now - 29 * SEC, now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/30/);
  });

  it('rejects immediate re-submission', () => {
    const result = guard({ jamStatus: 'running', participantId: 'user-1', lastSubmissionAt: now - 1 * SEC, now });
    expect(result.ok).toBe(false);
  });
});

describe('guard — system exemptions', () => {
  it('system:admin bypasses JAM idle check', () => {
    const result = guard({ jamStatus: 'idle', participantId: 'system:admin', lastSubmissionAt: null, now });
    expect(result.ok).toBe(true);
  });

  it('system:admin bypasses JAM ended check', () => {
    const result = guard({ jamStatus: 'ended', participantId: 'system:admin', lastSubmissionAt: null, now });
    expect(result.ok).toBe(true);
  });

  it('system:admin bypasses rate limit', () => {
    const result = guard({ jamStatus: 'running', participantId: 'system:admin', lastSubmissionAt: now - 1 * SEC, now });
    expect(result.ok).toBe(true);
  });

  it('system:narrator bypasses JAM idle check', () => {
    const result = guard({ jamStatus: 'idle', participantId: 'system:narrator', lastSubmissionAt: null, now });
    expect(result.ok).toBe(true);
  });

  it('system:narrator bypasses JAM ended check', () => {
    const result = guard({ jamStatus: 'ended', participantId: 'system:narrator', lastSubmissionAt: null, now });
    expect(result.ok).toBe(true);
  });

  it('system:narrator bypasses rate limit', () => {
    const result = guard({ jamStatus: 'running', participantId: 'system:narrator', lastSubmissionAt: now - 1 * SEC, now });
    expect(result.ok).toBe(true);
  });
});
