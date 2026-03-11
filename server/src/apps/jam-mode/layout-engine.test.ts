import { describe, it, expect } from 'vitest';
import { resolveLayout } from './layout-engine.js';
import type { MediaItem } from '../../../../shared/types.js';

type Item = Pick<MediaItem, 'type' | 'content'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const photo    = (caption: string | null = null): Item => ({ type: 'photo',    content: { url: '/p.jpg',  caption } });
const gif      = (caption: string | null = null): Item => ({ type: 'gif',      content: { url: '/g.gif',  caption } });
const clip     = (caption: string | null = null): Item => ({ type: 'clip',     content: { url: '/c.mp4',  duration: 30, mimeType: 'video/mp4', caption } });
const note     = ():                              Item => ({ type: 'note',     content: { text: 'hello' } });
const youtube  = (caption: string | null = null): Item => ({ type: 'youtube',  content: { url: '/yt', youtubeId: 'abc', title: 'title', duration: 180, thumbnail: '/thumb.jpg', caption } });
const linkThumb  = (caption: string | null = null): Item => ({ type: 'link', content: { url: 'https://x.com', title: 'T', description: null, thumbnail: '/t.jpg', siteName: null, caption } });
const linkNoThumb = (): Item => ({ type: 'link', content: { url: 'https://x.com', title: 'T', description: null, thumbnail: null, siteName: null, caption: null } });

// ─── Base layouts (no captions) ───────────────────────────────────────────────

describe('resolveLayout — empty', () => {
  it('[] → IDLE', () => {
    expect(resolveLayout([])).toBe('IDLE');
  });
});

describe('resolveLayout — single item', () => {
  it('[youtube] → MEDIA_FULL', () => {
    expect(resolveLayout([youtube()])).toBe('MEDIA_FULL');
  });

  it('[photo] → VISUAL_FULL', () => {
    expect(resolveLayout([photo()])).toBe('VISUAL_FULL');
  });

  it('[gif] → VISUAL_FULL', () => {
    expect(resolveLayout([gif()])).toBe('VISUAL_FULL');
  });

  it('[clip] → VISUAL_FULL', () => {
    expect(resolveLayout([clip()])).toBe('VISUAL_FULL');
  });

  it('[link with thumbnail] → VISUAL_FULL', () => {
    expect(resolveLayout([linkThumb()])).toBe('VISUAL_FULL');
  });

  it('[note] → NOTE_CARD', () => {
    expect(resolveLayout([note()])).toBe('NOTE_CARD');
  });

  it('[link without thumbnail] → NOTE_CARD', () => {
    expect(resolveLayout([linkNoThumb()])).toBe('NOTE_CARD');
  });
});

describe('resolveLayout — youtube + visual → MEDIA_WITH_VISUAL', () => {
  it('[youtube, photo]', ()  => expect(resolveLayout([youtube(), photo()])).toBe('MEDIA_WITH_VISUAL'));
  it('[youtube, gif]',   ()  => expect(resolveLayout([youtube(), gif()])).toBe('MEDIA_WITH_VISUAL'));
  it('[youtube, clip]',  ()  => expect(resolveLayout([youtube(), clip()])).toBe('MEDIA_WITH_VISUAL'));
  it('[youtube, link(thumb)]', () => expect(resolveLayout([youtube(), linkThumb()])).toBe('MEDIA_WITH_VISUAL'));
});

describe('resolveLayout — youtube + text → MEDIA_WITH_CAPTION', () => {
  it('[youtube, note]',          () => expect(resolveLayout([youtube(), note()])).toBe('MEDIA_WITH_CAPTION'));
  it('[youtube, link(no-thumb)]', () => expect(resolveLayout([youtube(), linkNoThumb()])).toBe('MEDIA_WITH_CAPTION'));
});

describe('resolveLayout — youtube + visual + note → MEDIA_WITH_VISUAL_AND_CAPTION', () => {
  it('[youtube, photo, note]', () => expect(resolveLayout([youtube(), photo(), note()])).toBe('MEDIA_WITH_VISUAL_AND_CAPTION'));
  it('[youtube, gif, note]',   () => expect(resolveLayout([youtube(), gif(), note()])).toBe('MEDIA_WITH_VISUAL_AND_CAPTION'));
  it('[youtube, clip, note]',  () => expect(resolveLayout([youtube(), clip(), note()])).toBe('MEDIA_WITH_VISUAL_AND_CAPTION'));
});

describe('resolveLayout — visual + note → VISUAL_WITH_CAPTION', () => {
  it('[photo, note]',       () => expect(resolveLayout([photo(), note()])).toBe('VISUAL_WITH_CAPTION'));
  it('[gif, note]',         () => expect(resolveLayout([gif(), note()])).toBe('VISUAL_WITH_CAPTION'));
  it('[clip, note]',        () => expect(resolveLayout([clip(), note()])).toBe('VISUAL_WITH_CAPTION'));
  it('[link(thumb), note]', () => expect(resolveLayout([linkThumb(), note()])).toBe('VISUAL_WITH_CAPTION'));
});

describe('resolveLayout — dual visual → DUAL_VISUAL', () => {
  it('[photo, photo]', () => expect(resolveLayout([photo(), photo()])).toBe('DUAL_VISUAL'));
  it('[photo, gif]',   () => expect(resolveLayout([photo(), gif()])).toBe('DUAL_VISUAL'));
  it('[gif, photo]',   () => expect(resolveLayout([gif(), photo()])).toBe('DUAL_VISUAL'));
});

// ─── Caption promotion (section 3.4) ─────────────────────────────────────────

describe('resolveLayout — single item with caption', () => {
  it('[photo + caption] → VISUAL_WITH_CAPTION', () => {
    expect(resolveLayout([photo('Great shot!')])).toBe('VISUAL_WITH_CAPTION');
  });

  it('[gif + caption] → VISUAL_WITH_CAPTION', () => {
    expect(resolveLayout([gif('Lol')])).toBe('VISUAL_WITH_CAPTION');
  });

  it('[clip + caption] → VISUAL_WITH_CAPTION', () => {
    expect(resolveLayout([clip('Watch this')])).toBe('VISUAL_WITH_CAPTION');
  });

  it('[youtube + caption] → MEDIA_WITH_CAPTION', () => {
    expect(resolveLayout([youtube('Great track')])).toBe('MEDIA_WITH_CAPTION');
  });
});

describe('resolveLayout — youtube + visual with caption', () => {
  it('[youtube, photo + caption] → MEDIA_WITH_VISUAL_AND_CAPTION', () => {
    expect(resolveLayout([youtube(), photo('Nice')])).toBe('MEDIA_WITH_VISUAL_AND_CAPTION');
  });

  it('[youtube, gif + caption] → MEDIA_WITH_VISUAL_AND_CAPTION', () => {
    expect(resolveLayout([youtube(), gif('Lol')])).toBe('MEDIA_WITH_VISUAL_AND_CAPTION');
  });
});
