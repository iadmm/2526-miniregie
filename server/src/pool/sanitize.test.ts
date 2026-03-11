import { describe, it, expect } from 'vitest';
import { sanitize } from './sanitize.js';

const MB = 1024 * 1024;

function file(overrides: { mimetype?: string; size?: number; originalname?: string } = {}) {
  return {
    originalname: overrides.originalname ?? 'file',
    mimetype:     overrides.mimetype     ?? 'image/jpeg',
    size:         overrides.size         ?? 1 * MB,
  };
}

// ─── photo ────────────────────────────────────────────────────────────────────

describe('sanitize — photo', () => {
  it('accepts JPEG', () => {
    const result = sanitize({ type: 'photo', file: file({ mimetype: 'image/jpeg' }) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.validated.type).toBe('photo');
  });

  it('accepts PNG', () => {
    const result = sanitize({ type: 'photo', file: file({ mimetype: 'image/png' }) });
    expect(result.ok).toBe(true);
  });

  it('rejects non-image MIME', () => {
    const result = sanitize({ type: 'photo', file: file({ mimetype: 'video/mp4' }) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/mime/i);
  });

  it('rejects GIF as photo', () => {
    const result = sanitize({ type: 'photo', file: file({ mimetype: 'image/gif' }) });
    expect(result.ok).toBe(false);
  });

  it('rejects file over 10 MB', () => {
    const result = sanitize({ type: 'photo', file: file({ size: 10 * MB + 1 }) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/size/i);
  });

  it('accepts file exactly at 10 MB', () => {
    const result = sanitize({ type: 'photo', file: file({ size: 10 * MB }) });
    expect(result.ok).toBe(true);
  });

  it('returns mimetype and size in validated output', () => {
    const result = sanitize({ type: 'photo', file: file({ mimetype: 'image/png', size: 2 * MB }) });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'photo') {
      expect(result.validated.mimetype).toBe('image/png');
      expect(result.validated.size).toBe(2 * MB);
    }
  });
});

// ─── gif ──────────────────────────────────────────────────────────────────────

describe('sanitize — gif', () => {
  it('accepts GIF', () => {
    const result = sanitize({ type: 'gif', file: file({ mimetype: 'image/gif' }) });
    expect(result.ok).toBe(true);
  });

  it('rejects JPEG as gif', () => {
    const result = sanitize({ type: 'gif', file: file({ mimetype: 'image/jpeg' }) });
    expect(result.ok).toBe(false);
  });

  it('rejects file over 10 MB', () => {
    const result = sanitize({ type: 'gif', file: file({ mimetype: 'image/gif', size: 10 * MB + 1 }) });
    expect(result.ok).toBe(false);
  });

  it('accepts file exactly at 10 MB', () => {
    const result = sanitize({ type: 'gif', file: file({ mimetype: 'image/gif', size: 10 * MB }) });
    expect(result.ok).toBe(true);
  });
});

// ─── note ─────────────────────────────────────────────────────────────────────

describe('sanitize — note', () => {
  it('accepts valid text', () => {
    const result = sanitize({ type: 'note', text: 'Hello world' });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'note') {
      expect(result.validated.text).toBe('Hello world');
    }
  });

  it('accepts text exactly at 280 characters', () => {
    const result = sanitize({ type: 'note', text: 'a'.repeat(280) });
    expect(result.ok).toBe(true);
  });

  it('rejects text over 280 characters', () => {
    const result = sanitize({ type: 'note', text: 'a'.repeat(281) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/280/);
  });

  it('rejects empty text', () => {
    const result = sanitize({ type: 'note', text: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects whitespace-only text', () => {
    const result = sanitize({ type: 'note', text: '   ' });
    expect(result.ok).toBe(false);
  });
});

// ─── link ─────────────────────────────────────────────────────────────────────

describe('sanitize — link', () => {
  it('accepts a valid https URL', () => {
    const result = sanitize({ type: 'link', url: 'https://example.com/page' });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'link') {
      expect(result.validated.url).toBe('https://example.com/page');
    }
  });

  it('rejects http URL', () => {
    const result = sanitize({ type: 'link', url: 'http://example.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/https/i);
  });

  it('rejects non-URL string', () => {
    const result = sanitize({ type: 'link', url: 'not a url' });
    expect(result.ok).toBe(false);
  });

  it('rejects empty string', () => {
    const result = sanitize({ type: 'link', url: '' });
    expect(result.ok).toBe(false);
  });
});

// ─── clip ─────────────────────────────────────────────────────────────────────

describe('sanitize — clip', () => {
  it('accepts MP4', () => {
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'video/mp4' }) });
    expect(result.ok).toBe(true);
  });

  it('accepts QuickTime (MOV)', () => {
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'video/quicktime' }) });
    expect(result.ok).toBe(true);
  });

  it('accepts WebM', () => {
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'video/webm' }) });
    expect(result.ok).toBe(true);
  });

  it('rejects image MIME', () => {
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'image/jpeg' }) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/mime/i);
  });

  it('rejects file over 50 MB', () => {
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'video/mp4', size: 50 * MB + 1 }) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/size/i);
  });

  it('accepts file exactly at 50 MB', () => {
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'video/mp4', size: 50 * MB }) });
    expect(result.ok).toBe(true);
  });

  it('does not check duration — that is RESOLVE responsibility', () => {
    // No duration field in RawInput — this test documents the design decision
    const result = sanitize({ type: 'clip', file: file({ mimetype: 'video/mp4' }) });
    expect(result.ok).toBe(true);
  });
});

// ─── interview ────────────────────────────────────────────────────────────────

describe('sanitize — interview', () => {
  it('accepts a single video segment', () => {
    const result = sanitize({
      type: 'interview',
      segments: [{ file: file({ mimetype: 'video/mp4' }) }],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts a single text-only segment', () => {
    const result = sanitize({
      type: 'interview',
      segments: [{ textOnly: 'My answer' }],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts mixed segments', () => {
    const result = sanitize({
      type: 'interview',
      segments: [
        { file: file({ mimetype: 'video/mp4' }) },
        { textOnly: 'My answer' },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'interview') {
      expect(result.validated.segments).toHaveLength(2);
    }
  });

  it('rejects empty segments array', () => {
    const result = sanitize({ type: 'interview', segments: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/segment/i);
  });

  it('rejects invalid MIME in a segment', () => {
    const result = sanitize({
      type: 'interview',
      segments: [{ file: file({ mimetype: 'image/jpeg' }) }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects oversized file in a segment', () => {
    const result = sanitize({
      type: 'interview',
      segments: [{ file: file({ mimetype: 'video/mp4', size: 50 * MB + 1 }) }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects if any segment is invalid even when others are valid', () => {
    const result = sanitize({
      type: 'interview',
      segments: [
        { file: file({ mimetype: 'video/mp4' }) },
        { file: file({ mimetype: 'image/jpeg' }) }, // invalid
      ],
    });
    expect(result.ok).toBe(false);
  });
});
