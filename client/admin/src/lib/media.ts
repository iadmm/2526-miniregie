import type { MediaItem } from '@shared/types';

export const TYPE_COLOR: Record<string, string> = {
  photo:     'var(--accent)',
  gif:       '#a855f7',
  note:      'var(--warning)',
  clip:      'var(--ready)',
  ticker:    'var(--accent-dim)',
  youtube:   'var(--live)',
  link:      'var(--text-muted)',
  interview: '#06b6d4',
};

export const TYPE_LABEL: Record<string, string> = {
  photo:     'photo',
  gif:       'gif',
  note:      'note',
  clip:      'clip',
  ticker:    'ticker',
  youtube:   'yt',
  link:      'link',
  interview: 'intv',
};

export function itemLabel(item: MediaItem, maxLen = 80): string {
  const c = item.content as Record<string, unknown>;
  if (typeof c.text    === 'string') return c.text.slice(0, maxLen);
  if (typeof c.title   === 'string') return c.title.slice(0, maxLen);
  if (typeof c.caption === 'string' && c.caption) return c.caption.slice(0, maxLen);
  return '—';
}
