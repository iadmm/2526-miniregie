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

  it('accepts text exactly at 500 characters', () => {
    const result = sanitize({ type: 'note', text: 'a'.repeat(500) });
    expect(result.ok).toBe(true);
  });

  it('rejects text over 500 characters', () => {
    const result = sanitize({ type: 'note', text: 'a'.repeat(501) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/500/);
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

// ─── note — URL auto-detection ────────────────────────────────────────────────

describe('sanitize — note URL detection', () => {
  it('detects a bare YouTube URL and returns type youtube', () => {
    const result = sanitize({ type: 'note', text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validated.type).toBe('youtube');
      if (result.validated.type === 'youtube') {
        expect(result.validated.youtubeId).toBe('dQw4w9WgXcQ');
        expect(result.validated.caption).toBeUndefined();
      }
    }
  });

  it('detects a YouTube URL with surrounding text and extracts caption', () => {
    const result = sanitize({ type: 'note', text: 'Check this out https://youtu.be/dQw4w9WgXcQ amazing' });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'youtube') {
      expect(result.validated.youtubeId).toBe('dQw4w9WgXcQ');
      expect(result.validated.caption).toBe('Check this out amazing');
    }
  });

  it('detects a bare Giphy URL and returns type giphy', () => {
    const result = sanitize({ type: 'note', text: 'https://giphy.com/gifs/some-title-abc123XYZ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validated.type).toBe('giphy');
      if (result.validated.type === 'giphy') {
        expect(result.validated.giphyId).toBe('abc123XYZ');
        expect(result.validated.caption).toBeUndefined();
      }
    }
  });

  it('detects a Giphy URL with caption text', () => {
    const result = sanitize({ type: 'note', text: 'Haha https://giphy.com/gifs/funny-abc123XYZ laughing' });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'giphy') {
      expect(result.validated.caption).toBe('Haha laughing');
    }
  });

  it('stays as note when the URL is not YouTube, Giphy, or an image', () => {
    const result = sanitize({ type: 'note', text: 'See https://example.com for details' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.validated.type).toBe('note');
  });

  it('detects a direct JPEG URL and returns type photo-url', () => {
    const result = sanitize({ type: 'note', text: 'https://cdn.example.com/image.jpg' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validated.type).toBe('photo-url');
      if (result.validated.type === 'photo-url') {
        expect(result.validated.url).toBe('https://cdn.example.com/image.jpg');
        expect(result.validated.caption).toBeUndefined();
      }
    }
  });

  it('detects a direct PNG URL with surrounding caption', () => {
    const result = sanitize({ type: 'note', text: 'Our team https://cdn.example.com/team.png at the event' });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'photo-url') {
      expect(result.validated.caption).toBe('Our team at the event');
    }
  });

  it('detects a direct GIF URL and returns type gif-url', () => {
    const result = sanitize({ type: 'note', text: 'https://cdn.example.com/anim.gif' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.validated.type).toBe('gif-url');
  });

  it('detects a WEBP URL as photo-url', () => {
    const result = sanitize({ type: 'note', text: 'https://cdn.example.com/photo.webp' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.validated.type).toBe('photo-url');
  });

  it('strips trailing punctuation from detected URL', () => {
    const result = sanitize({ type: 'note', text: 'Watch https://youtu.be/dQw4w9WgXcQ.' });
    expect(result.ok).toBe(true);
    if (result.ok && result.validated.type === 'youtube') {
      expect(result.validated.youtubeId).toBe('dQw4w9WgXcQ');
    }
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
