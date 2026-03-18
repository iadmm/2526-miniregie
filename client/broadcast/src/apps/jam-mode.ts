import type { BroadcastApp } from '../types.js';
import type { GlobalState, MediaItem, MediaContent, MediaType } from '@shared/types';
import type { Socket } from 'socket.io-client';

// ─── Layout types ─────────────────────────────────────────────────────────────

type LayoutName =
  | 'IDLE'
  | 'MEDIA_FULL'
  | 'VISUAL_FULL'
  | 'NOTE_CARD'
  | 'MEDIA_WITH_VISUAL'
  | 'MEDIA_WITH_CAPTION'
  | 'MEDIA_WITH_VISUAL_AND_CAPTION'
  | 'VISUAL_WITH_CAPTION'
  | 'DUAL_VISUAL';

// ─── Config constants (§10) ───────────────────────────────────────────────────

const AUDIO_AFFINITY_BONUS = 150;

const DURATIONS: Partial<Record<MediaType, { normal: number | null; extended: number | null }>> = {
  photo: { normal: 20_000, extended: 45_000 },
  gif:   { normal: 20_000, extended: 45_000 },
  clip:  { normal: null,   extended: null },
  note:  { normal: 12_000, extended: 30_000 },
  link:  { normal: 15_000, extended: 35_000 },
};

const BUFFER_EVERY = 5;
const BUFFER_DURATION = 12_000;
const GRACE_PERIOD = 800;
const PREFETCH_LEAD = 2_000;
const MIN_LAYOUT_DURATION = 4_000;

// ─── Layout helpers ───────────────────────────────────────────────────────────

function hasCaption(content: MediaContent): boolean {
  return 'caption' in content && (content as { caption: string | null }).caption !== null;
}

function isVisualItem(item: MediaItem): boolean {
  if (item.type === 'link') {
    return (item.content as { thumbnail: string | null }).thumbnail !== null;
  }
  return item.type === 'photo' || item.type === 'gif' || item.type === 'clip';
}

function isTextItem(item: MediaItem): boolean {
  if (item.type === 'link') {
    return (item.content as { thumbnail: string | null }).thumbnail === null;
  }
  return item.type === 'note';
}

function resolveLayout(activeItems: MediaItem[]): LayoutName {
  if (activeItems.length === 0) return 'IDLE';

  const [a, b, c] = activeItems;

  if (activeItems.length === 1) {
    if (a!.type === 'youtube') return hasCaption(a!.content) ? 'MEDIA_WITH_CAPTION' : 'MEDIA_FULL';
    if (isVisualItem(a!)) return hasCaption(a!.content) ? 'VISUAL_WITH_CAPTION' : 'VISUAL_FULL';
    if (isTextItem(a!)) return 'NOTE_CARD';
  }

  if (activeItems.length === 2 && a!.type === 'youtube') {
    if (isVisualItem(b!)) return hasCaption(b!.content) ? 'MEDIA_WITH_VISUAL_AND_CAPTION' : 'MEDIA_WITH_VISUAL';
    if (isTextItem(b!)) return 'MEDIA_WITH_CAPTION';
  }

  if (activeItems.length === 2 && isVisualItem(a!) && isVisualItem(b!)) return 'DUAL_VISUAL';
  if (activeItems.length === 2 && isVisualItem(a!) && isTextItem(b!)) return 'VISUAL_WITH_CAPTION';

  if (activeItems.length === 3 && a!.type === 'youtube' && b !== undefined && isVisualItem(b) && c !== undefined && isTextItem(c)) {
    return 'MEDIA_WITH_VISUAL_AND_CAPTION';
  }

  return 'IDLE';
}

function layoutToCssClass(layout: LayoutName): string {
  return 'layout--' + layout.toLowerCase().replace(/_/g, '-');
}

// ─── Item rendering ───────────────────────────────────────────────────────────

function renderItemEl(item: MediaItem): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `media-item media-item--${item.type}`;
  wrapper.dataset['itemId'] = item.id;

  switch (item.type) {
    case 'photo': {
      const c = item.content as { url: string; caption: string | null };
      const img = document.createElement('img');
      img.src = c.url;
      img.alt = c.caption ?? '';
      img.className = 'media-item__image';
      wrapper.appendChild(img);
      if (c.caption) {
        const cap = document.createElement('p');
        cap.className = 'media-item__caption';
        cap.textContent = c.caption;
        wrapper.appendChild(cap);
      }
      break;
    }
    case 'gif': {
      const c = item.content as { url: string; caption: string | null };
      const img = document.createElement('img');
      img.src = c.url;
      img.alt = c.caption ?? '';
      img.className = 'media-item__image';
      wrapper.appendChild(img);
      break;
    }
    case 'clip': {
      const c = item.content as { url: string; duration: number; mimeType: string; caption: string | null };
      const video = document.createElement('video');
      video.src = c.url;
      video.autoplay = true;
      video.muted = true;
      video.loop = false;
      video.playsInline = true;
      video.className = 'media-item__video';
      wrapper.appendChild(video);
      break;
    }
    case 'note': {
      const c = item.content as { text: string };
      const text = document.createElement('p');
      text.className = 'media-item__note-text';
      text.textContent = c.text;
      wrapper.appendChild(text);
      const author = document.createElement('p');
      author.className = 'media-item__author';
      author.textContent = `— @${item.author.displayName}`;
      wrapper.appendChild(author);
      break;
    }
    case 'link': {
      const c = item.content as { url: string; title: string | null; description: string | null; thumbnail: string | null; siteName: string | null };
      if (c.thumbnail) {
        const img = document.createElement('img');
        img.src = c.thumbnail;
        img.alt = c.title ?? '';
        img.className = 'media-item__image';
        wrapper.appendChild(img);
      }
      const meta = document.createElement('div');
      meta.className = 'media-item__link-meta';
      if (c.title) {
        const t = document.createElement('p');
        t.className = 'media-item__link-title';
        t.textContent = c.title;
        meta.appendChild(t);
      }
      if (c.description) {
        const d = document.createElement('p');
        d.className = 'media-item__link-desc';
        d.textContent = c.description;
        meta.appendChild(d);
      }
      if (c.siteName) {
        const s = document.createElement('p');
        s.className = 'media-item__link-site';
        s.textContent = c.siteName;
        meta.appendChild(s);
      }
      wrapper.appendChild(meta);
      break;
    }
    case 'youtube': {
      // YouTube iframe — actual src set on play() to avoid autoplay race
      const c = item.content as { youtubeId: string; title: string };
      const iframe = document.createElement('iframe');
      iframe.className = 'media-item__youtube';
      iframe.dataset['youtubeId'] = c.youtubeId;
      iframe.allow = 'autoplay; fullscreen';
      iframe.setAttribute('frameborder', '0');
      iframe.title = c.title;
      wrapper.appendChild(iframe);
      break;
    }
  }

  return wrapper;
}

// ─── YouTube IFrame API ───────────────────────────────────────────────────────

// We declare a minimal subset of the YT API we actually use.
interface YTPlayer {
  stopVideo(): void;
  destroy(): void;
  getPlayerState(): number;
}

interface YTPlayerOptions {
  height: string;
  width: string;
  videoId: string;
  playerVars: Record<string, unknown>;
  events: {
    onStateChange?: (event: { data: number }) => void;
  };
}

declare const YT: {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    PLAYING: number;
    ENDED: number;
  };
};

// ─── Main app factory ─────────────────────────────────────────────────────────

export function createJamMode(): BroadcastApp {
  let mounted = false;
  let container: HTMLElement | null = null;
  let socket: Socket | null = null;
  let currentSnapshot: MediaItem[] = [];

  // Layout state
  let activeItems: MediaItem[] = [];
  let regime: 'normal' | 'hold' | 'buffer' = 'normal';
  let bufferActive = false;
  let visualCount = 0;
  let currentLayout: LayoutName = 'IDLE';
  let lastLayoutChange = 0;

  // Timers (all collected for clearAll)
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function safeTimeout(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.add(id);
    return id;
  }

  function clearAllTimers(): void {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  // Grace period collapse timers keyed by slot index
  const collapseTimers = new Map<number, ReturnType<typeof setTimeout>>();

  // Prefetch
  let nextCandidate: MediaItem | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;

  // YouTube singleton
  let ytPlayer: YTPlayer | null = null;
  let ytWatchdog: ReturnType<typeof setTimeout> | null = null;

  // ── Socket event handler refs ─────────────────────────────────────────────

  let poolReadyHandler: (() => void) | null = null;

  // ── Pool access ───────────────────────────────────────────────────────────

  function getSnapshot(): MediaItem[] {
    return currentSnapshot;
  }

  function getQueue(opts?: { types?: MediaType[]; excludeIds?: string[] }): MediaItem[] {
    let items = getSnapshot().filter(i => i.status === 'ready');
    if (opts?.types) {
      items = items.filter(i => opts.types!.includes(i.type));
    }
    if (opts?.excludeIds) {
      const ex = new Set(opts.excludeIds);
      items = items.filter(i => !ex.has(i.id));
    }
    return items;
  }

  // ── Emit mark events ─────────────────────────────────────────────────────

  function markDisplayed(item: MediaItem): void {
    socket?.emit('pool:mark', { itemId: item.id, event: 'displayed' });
  }

  function markSkipped(item: MediaItem): void {
    socket?.emit('pool:mark', { itemId: item.id, event: 'skipped' });
  }

  function markHeld(item: MediaItem, durationMs: number): void {
    socket?.emit('pool:mark', { itemId: item.id, event: 'held', payload: { duration: durationMs } });
  }

  // ── On-air state reporting ────────────────────────────────────────────────

  /**
   * Emits the current on-air state to the server so that the admin UI can
   * observe what jam-mode is displaying.  Called after any change to
   * `activeItems` or `regime`.
   */
  function emitJamState(): void {
    socket?.emit('jam:state-update', {
      activeItemIds: activeItems.map(i => i.id),
      regime,
    });
  }

  // ── Layout rendering ──────────────────────────────────────────────────────

  function applyLayout(layout: LayoutName, items: MediaItem[]): void {
    if (!container) return;

    // Respect MIN_LAYOUT_DURATION — only skip if it's the same layout
    if (layout === currentLayout && Date.now() - lastLayoutChange < MIN_LAYOUT_DURATION) {
      return;
    }

    // Remove old layout class
    const oldClass = layoutToCssClass(currentLayout);
    container.classList.remove(oldClass);
    container.classList.add(layoutToCssClass(layout));

    currentLayout = layout;
    lastLayoutChange = Date.now();

    renderLayout(items);
  }

  function renderLayout(items: MediaItem[]): void {
    if (!container) return;

    // Clear existing slots
    container.querySelectorAll('.jam-slot').forEach(s => s.remove());

    const layout = currentLayout;

    if (layout === 'IDLE') {
      // Nothing rendered — persistent layer shows countdown
      return;
    }

    if (layout === 'MEDIA_FULL' || layout === 'MEDIA_WITH_CAPTION') {
      // Primary: youtube; caption: second item or youtube caption
      const primary = items[0];
      if (!primary) return;
      const primarySlot = createSlot('primary');
      primarySlot.appendChild(renderItemEl(primary));
      container.appendChild(primarySlot);

      if (layout === 'MEDIA_WITH_CAPTION') {
        const captionItem = items[1] ?? primary;
        const captionSlot = createSlot('caption');
        captionSlot.appendChild(renderCaptionEl(captionItem, primary));
        container.appendChild(captionSlot);
      }
      mountYoutube(primary);
      return;
    }

    if (layout === 'VISUAL_FULL' || layout === 'NOTE_CARD' || layout === 'VISUAL_WITH_CAPTION') {
      const primary = items[0];
      if (!primary) return;
      const primarySlot = createSlot('primary');
      primarySlot.appendChild(renderItemEl(primary));
      container.appendChild(primarySlot);

      if (layout === 'VISUAL_WITH_CAPTION') {
        const captionItem = items[1] ?? primary;
        const captionSlot = createSlot('caption');
        captionSlot.appendChild(renderCaptionEl(captionItem, primary));
        container.appendChild(captionSlot);
      }
      return;
    }

    if (layout === 'MEDIA_WITH_VISUAL' || layout === 'MEDIA_WITH_VISUAL_AND_CAPTION') {
      const [yt, visual, note] = items;
      if (!yt || !visual) return;

      const primarySlot = createSlot('primary');
      primarySlot.appendChild(renderItemEl(yt));
      container.appendChild(primarySlot);

      const secondarySlot = createSlot('secondary');
      secondarySlot.appendChild(renderItemEl(visual));
      container.appendChild(secondarySlot);

      if (layout === 'MEDIA_WITH_VISUAL_AND_CAPTION' && note) {
        const captionSlot = createSlot('caption');
        captionSlot.appendChild(renderCaptionEl(note, yt));
        container.appendChild(captionSlot);
      }
      mountYoutube(yt);
      return;
    }

    if (layout === 'DUAL_VISUAL') {
      const [a, b] = items;
      if (!a || !b) return;
      const slotA = createSlot('primary');
      slotA.appendChild(renderItemEl(a));
      const slotB = createSlot('secondary');
      slotB.appendChild(renderItemEl(b));
      container.appendChild(slotA);
      container.appendChild(slotB);
      return;
    }
  }

  function createSlot(role: 'primary' | 'secondary' | 'caption'): HTMLElement {
    const el = document.createElement('div');
    el.className = `jam-slot jam-slot--${role}`;
    return el;
  }

  function renderCaptionEl(captionItem: MediaItem, _primaryItem: MediaItem): HTMLElement {
    const el = document.createElement('div');
    el.className = 'jam-caption';
    if (captionItem.type === 'note') {
      const c = captionItem.content as { text: string };
      el.textContent = c.text;
    } else if ('caption' in captionItem.content && (captionItem.content as { caption: string | null }).caption) {
      el.textContent = (captionItem.content as { caption: string | null }).caption!;
    }
    return el;
  }

  // ── YouTube singleton ──────────────────────────────────────────────────────

  function mountYoutube(item: MediaItem): void {
    if (!mounted) return;
    if (item.type !== 'youtube') return;

    const c = item.content as { youtubeId: string; title: string; duration: number };
    const iframe = container?.querySelector<HTMLIFrameElement>('.media-item__youtube');
    if (!iframe) return;

    // If player already exists with same videoId — reuse
    if (ytPlayer !== null) {
      // Destroy and recreate to avoid double audio
      destroyYoutube();
    }

    try {
      ytPlayer = new YT.Player(iframe, {
        height: '100%',
        width: '100%',
        videoId: c.youtubeId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onStateChange: (event) => {
            if (!mounted) return;
            if (event.data === YT.PlayerState.ENDED) {
              onYoutubeEnded(item);
            }
          },
        },
      });

      // Watchdog: 8s to reach PLAYING state
      if (ytWatchdog !== null) clearTimeout(ytWatchdog);
      ytWatchdog = safeTimeout(() => {
        if (!mounted) return;
        try {
          if (ytPlayer && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
            markSkipped(item);
            removeItemFromActive(item.id);
            fetchNext();
          }
        } catch {
          // Player may be in a bad state
          markSkipped(item);
          removeItemFromActive(item.id);
          fetchNext();
        }
      }, 8_000);
    } catch {
      // YT API not available — skip
      markSkipped(item);
    }
  }

  function destroyYoutube(): void {
    if (ytWatchdog !== null) {
      clearTimeout(ytWatchdog);
      timers.delete(ytWatchdog);
      ytWatchdog = null;
    }
    if (ytPlayer !== null) {
      try {
        ytPlayer.stopVideo();
        ytPlayer.destroy();
      } catch {
        // Player may already be dead
      }
      ytPlayer = null;
    }
  }

  function onYoutubeEnded(item: MediaItem): void {
    if (!mounted) return;
    markDisplayed(item);
    removeItemFromActive(item.id);
    // Fetch next with audio affinity bonus (activeItems is now without youtube)
    fetchNext({ audioAffinity: true });
  }

  // ── Active items management ────────────────────────────────────────────────

  function removeItemFromActive(id: string): void {
    activeItems = activeItems.filter(i => i.id !== id);
    emitJamState();
  }

  function addItemToActive(item: MediaItem): void {
    // Constraint: never two audio sources
    if (item.type === 'youtube') {
      const existingYt = activeItems.find(i => i.type === 'youtube');
      if (existingYt) {
        markSkipped(item);
        return;
      }
    }
    activeItems.push(item);
    emitJamState();
    const layout = resolveLayout(activeItems);
    applyLayout(layout, activeItems);
  }

  // ── Item duration ──────────────────────────────────────────────────────────

  function getItemDuration(item: MediaItem, reg: 'normal' | 'hold'): number {
    if (item.type === 'clip') {
      const c = item.content as { duration: number };
      return Math.max(c.duration, 10_000);
    }
    if (item.type === 'youtube') {
      // Duration managed by YouTube ended event, not a timer
      return 0;
    }
    // link: treat like photo if has thumbnail, else like note
    const typeKey = item.type === 'link'
      ? (isVisualItem(item) ? 'link' : 'note')
      : item.type;

    const durationSpec = DURATIONS[typeKey as MediaType];
    if (!durationSpec) return 20_000;

    const val = reg === 'hold' ? durationSpec.extended : durationSpec.normal;
    return val ?? 20_000;
  }

  // ── fetchNext ─────────────────────────────────────────────────────────────

  let holdStartTime = 0;

  function fetchNext(opts?: { audioAffinity?: boolean; excludeIds?: string[] }): void {
    if (!mounted) return;

    const excluded = [
      ...(opts?.excludeIds ?? []),
      ...activeItems.map(i => i.id),
    ];

    // Determine what types to fetch based on current activeItems
    const hasYoutube = activeItems.some(i => i.type === 'youtube');

    let candidates: MediaItem[];

    if (hasYoutube) {
      // Fetch only visual/text companions
      candidates = getQueue({
        types: ['photo', 'gif', 'clip', 'link', 'note'],
        excludeIds: excluded,
      });
    } else {
      candidates = getQueue({
        types: ['photo', 'gif', 'clip', 'link', 'note', 'youtube'],
        excludeIds: excluded,
      });

      // Apply audio affinity bonus for youtube when appropriate
      if (opts?.audioAffinity || activeItems.length === 0) {
        candidates = candidates.sort((a, b) => {
          const bonusA = a.type === 'youtube' ? AUDIO_AFFINITY_BONUS : 0;
          const bonusB = b.type === 'youtube' ? AUDIO_AFFINITY_BONUS : 0;
          return (b.priority + bonusB) - (a.priority + bonusA);
        });
      }
    }

    const nextItem = candidates[0] ?? null;

    if (nextItem === null) {
      // Enter hold regime
      regime = 'hold';
      emitJamState();
      holdStartTime = Date.now();

      // If there are active items in hold, schedule rebounce
      const currentItem = activeItems[0];
      const extendedDuration = currentItem
        ? getItemDuration(currentItem, 'hold')
        : 45_000;

      holdTimer = safeTimeout(() => {
        if (!mounted) return;
        holdTimer = null;
        fetchNext();
      }, extendedDuration);

      return;
    }

    // We have an item — exit hold if we were in it
    if (regime === 'hold' && holdStartTime > 0) {
      const duration = Date.now() - holdStartTime;
      const heldItem = activeItems[0];
      if (heldItem) markHeld(heldItem, duration);
      holdStartTime = 0;
    }
    regime = 'normal';
    emitJamState();

    scheduleItem(nextItem);
  }

  function scheduleItem(item: MediaItem): void {
    if (!mounted) return;

    addItemToActive(item);

    // For youtube, timer is handled by onYoutubeEnded event
    if (item.type === 'youtube') {
      // Fetch a visual companion immediately
      fetchNextVisual();
      return;
    }

    const duration = getItemDuration(item, regime);
    let prefetchDone = false;

    // Pre-fetch lead: 2s before expiry, line up next item
    if (duration > PREFETCH_LEAD + 1_000) {
      safeTimeout(() => {
        if (!mounted) return;
        const excluded = activeItems.map(i => i.id);
        const hasYt = activeItems.some(i => i.type === 'youtube');
        const types: MediaType[] = hasYt
          ? ['photo', 'gif', 'clip', 'link', 'note']
          : ['photo', 'gif', 'clip', 'link', 'note', 'youtube'];
        const cands = getQueue({ types, excludeIds: excluded });
        nextCandidate = cands[0] ?? null;
        prefetchDone = true;
      }, duration - PREFETCH_LEAD);
    }

    // Main timer — when item expires
    safeTimeout(() => {
      if (!mounted) return;

      const isVisual = isVisualItem(item);

      if (isVisual) {
        visualCount++;
        if (visualCount % BUFFER_EVERY === 0) {
          bufferActive = true;
          regime = 'buffer';
          emitJamState();
          removeItemFromActive(item.id);
          markDisplayed(item);
          applyLayout(resolveLayout(activeItems), activeItems);

          safeTimeout(() => {
            if (!mounted) return;
            bufferActive = false;
            regime = 'normal';
            emitJamState();
            fetchNextVisual();
          }, BUFFER_DURATION);
          return;
        }
      }

      if (prefetchDone && nextCandidate !== null) {
        const candidate = nextCandidate;
        nextCandidate = null;
        markDisplayed(item);
        removeItemFromActive(item.id);
        applyLayout(resolveLayout(activeItems), activeItems);
        scheduleItem(candidate);
      } else {
        markDisplayed(item);
        removeItemFromActive(item.id);

        // Grace period before committing to layout change
        const slotIdx = 0;
        const existing = collapseTimers.get(slotIdx);
        if (existing !== undefined) {
          clearTimeout(existing);
          timers.delete(existing);
        }

        const collapseId = safeTimeout(() => {
          collapseTimers.delete(slotIdx);
          if (!mounted) return;
          applyLayout(resolveLayout(activeItems), activeItems);
          fetchNext();
        }, GRACE_PERIOD);
        collapseTimers.set(slotIdx, collapseId);
      }
    }, duration);
  }

  function fetchNextVisual(): void {
    if (!mounted) return;
    if (bufferActive) return;

    const excluded = activeItems.map(i => i.id);
    const candidates = getQueue({
      types: ['photo', 'gif', 'clip', 'link', 'note'],
      excludeIds: excluded,
    });

    const item = candidates[0] ?? null;
    if (item === null) {
      // No visual companion — layout falls back to MEDIA_FULL (youtube only)
      // The youtube timer / ended event handles progression
      return;
    }
    scheduleItem(item);
  }

  // ── Pool update handler ────────────────────────────────────────────────────

  function onPoolReady(): void {
    if (!mounted) return;

    // Re-read latest snapshot (server pushes state after pool:item:ready)
    // If we're in hold, immediately exit and fetch
    if (regime === 'hold') {
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        timers.delete(holdTimer);
        holdTimer = null;
      }
      regime = 'normal';
      emitJamState();
      fetchNext();
    } else if (activeItems.length < 2) {
      // Slot available — opportunistic fetch
      fetchNext();
    }
  }

  // ── Mount / unmount ───────────────────────────────────────────────────────

  return {
    mount(cont: HTMLElement, state: GlobalState, sock: Socket): void {
      mounted = true;
      container = cont;
      socket = sock;
      currentSnapshot = state.pool.queueSnapshot;

      container.className = 'app app--jam-mode';

      // Listen for state updates to refresh snapshot
      sock.on('state', (s: GlobalState) => {
        if (!mounted) return;
        currentSnapshot = s.pool.queueSnapshot;
      });

      // Listen for new items
      poolReadyHandler = () => {
        if (!mounted) return;
        onPoolReady();
      };
      sock.on('pool:item:ready', poolReadyHandler);

      // Bootstrap
      fetchNext({ audioAffinity: true });
    },

    unmount(): void {
      mounted = false;

      // Notify the server that jam-mode is no longer active
      socket?.emit('jam:state-update', { activeItemIds: [], regime: 'normal' });

      clearAllTimers();

      for (const id of collapseTimers.values()) clearTimeout(id);
      collapseTimers.clear();

      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }

      // Mark any items that are in hold regime
      if (regime === 'hold' && holdStartTime > 0) {
        const duration = Date.now() - holdStartTime;
        for (const item of activeItems) {
          markHeld(item, duration);
        }
      }

      destroyYoutube();

      if (socket !== null && poolReadyHandler !== null) {
        socket.off('pool:item:ready', poolReadyHandler);
      }

      activeItems = [];
      currentSnapshot = [];
      regime = 'normal';
      bufferActive = false;
      visualCount = 0;
      currentLayout = 'IDLE';
      nextCandidate = null;
      holdTimer = null;
      holdStartTime = 0;
      container = null;
      socket = null;
      poolReadyHandler = null;
    },
  };
}