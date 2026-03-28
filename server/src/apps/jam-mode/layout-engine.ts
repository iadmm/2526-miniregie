import type { MediaItem, MediaContent, LayoutName } from '../../../../shared/types.js';

export type { LayoutName };

type Item = Pick<MediaItem, 'type' | 'content'>;

function hasCaption(content: MediaContent): boolean {
  return 'caption' in content && content.caption !== null;
}

function isVisual(item: Item): boolean {
  if (item.type === 'link') return (item.content as { thumbnail: string | null }).thumbnail !== null;
  return item.type === 'photo' || item.type === 'gif' || item.type === 'clip';
}

function isText(item: Item): boolean {
  if (item.type === 'link') return (item.content as { thumbnail: string | null }).thumbnail === null;
  return item.type === 'note';
}

export function resolveLayout(activeItems: Item[]): LayoutName {
  if (activeItems.length === 0) return 'IDLE';

  const [a, b, c] = activeItems;

  // Single item
  if (activeItems.length === 1) {
    if (a!.type === 'youtube') return hasCaption(a!.content) ? 'MEDIA_WITH_CAPTION' : 'MEDIA_FULL';
    if (isVisual(a!))          return hasCaption(a!.content) ? 'VISUAL_WITH_CAPTION' : 'VISUAL_FULL';
    if (isText(a!))            return 'NOTE_CARD';
  }

  // Two items — first is youtube
  if (activeItems.length === 2 && a!.type === 'youtube') {
    if (isVisual(b!)) return hasCaption(b!.content) ? 'MEDIA_VIS_CAP' : 'MEDIA_WITH_VISUAL';
    if (isText(b!))   return 'MEDIA_WITH_CAPTION';
  }

  // Two items — both visuals
  if (activeItems.length === 2 && isVisual(a!) && isVisual(b!)) return 'DUAL_VISUAL';

  // Two items — visual + note
  if (activeItems.length === 2 && isVisual(a!) && isText(b!)) return 'VISUAL_WITH_CAPTION';

  // Three items — youtube + visual + note
  if (activeItems.length === 3 && a!.type === 'youtube' && isVisual(b!) && isText(c!)) {
    return 'MEDIA_VIS_CAP';
  }

  return 'IDLE';
}
