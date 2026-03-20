// SceneEngine — manages #scene-layer.
//
// Two independent timers:
//   sceneTimer    — primary item display duration
//   companionTimer — companion item display duration
//
// YouTube singleton: the player is never destroyed between scenes.
//   - When primary is YouTube → show+play
//   - When primary changes to non-YouTube → player is paused/hidden, not destroyed
//   - End-of-video fires onSceneEnd callback
//
// Anti-thrashing: GRACE_PERIOD (800ms) between layout recompositions.
// Prefetch signal: PREFETCH_LEAD (2000ms) before scene end → onPrefetchNeeded().
//
// Companion rule: if scene ends before companion → companion NOT marked displayed
//   (caller is responsible for not marking it — just stop the companion timer).

import type { MediaItem, MediaContent } from '@shared/types';
import { ENGINE_CONFIG } from './engine-config.js';

// ─── Layout types ─────────────────────────────────────────────────────────────

export type LayoutName =
  | 'IDLE'
  | 'MEDIA_FULL'
  | 'MEDIA_WITH_VISUAL'
  | 'MEDIA_WITH_CAPTION'
  | 'VISUAL_FULL'
  | 'VISUAL_WITH_CAPTION'
  | 'NOTE_CARD';

// ─── YouTube IFrame API minimal types ─────────────────────────────────────────

interface YTPlayer {
  loadVideoById(id: string): void;
  stopVideo(): void;
  destroy(): void;
  getPlayerState(): number;
}
interface YTPlayerOptions {
  height: string;
  width: string;
  videoId: string;
  playerVars: Record<string, unknown>;
  events: { onStateChange?: (e: { data: number }) => void };
}
declare const YT: {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasCaption(content: MediaContent): boolean {
  return 'caption' in content && (content as { caption: string | null }).caption !== null;
}

export function isVisual(item: MediaItem): boolean {
  if (item.type === 'link') return (item.content as { thumbnail: string | null }).thumbnail !== null;
  return item.type === 'photo' || item.type === 'gif' || item.type === 'clip';
}

export function isText(item: MediaItem): boolean {
  if (item.type === 'link') return (item.content as { thumbnail: string | null }).thumbnail === null;
  return item.type === 'note';
}

export function resolveLayout(primary: MediaItem | null, companion: MediaItem | null): LayoutName {
  if (!primary) return 'IDLE';

  if (!companion) {
    if (primary.type === 'youtube') return hasCaption(primary.content) ? 'MEDIA_WITH_CAPTION' : 'MEDIA_FULL';
    if (isVisual(primary)) return hasCaption(primary.content) ? 'VISUAL_WITH_CAPTION' : 'VISUAL_FULL';
    return 'NOTE_CARD';
  }

  // YouTube primary + companion
  if (primary.type === 'youtube') {
    if (isVisual(companion)) return 'MEDIA_WITH_VISUAL';
    if (isText(companion))   return 'MEDIA_WITH_CAPTION';
  }

  // Visual primary + note companion
  if (isVisual(primary) && isText(companion)) return 'VISUAL_WITH_CAPTION';

  // Fallback: show primary alone
  if (primary.type === 'youtube') return 'MEDIA_FULL';
  if (isVisual(primary)) return 'VISUAL_FULL';
  return 'NOTE_CARD';
}

function layoutClass(layout: LayoutName): string {
  return 'layout--' + layout.toLowerCase().replace(/_/g, '-');
}

// ─── Item element rendering ───────────────────────────────────────────────────

function renderItem(item: MediaItem): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `media-item media-item--${item.type}`;
  wrap.dataset['itemId'] = item.id;

  switch (item.type) {
    case 'photo':
    case 'gif': {
      const c = item.content as { url: string; caption: string | null };
      const img = document.createElement('img');
      img.src = c.url; img.alt = c.caption ?? ''; img.className = 'media-item__image';
      wrap.appendChild(img);
      if (c.caption) {
        const cap = document.createElement('p');
        cap.className = 'media-item__caption'; cap.textContent = c.caption;
        wrap.appendChild(cap);
      }
      break;
    }
    case 'clip': {
      const c = item.content as { url: string; mimeType: string; caption: string | null };
      const vid = document.createElement('video');
      vid.src = c.url; vid.autoplay = true; vid.muted = true;
      vid.loop = false; vid.playsInline = true; vid.className = 'media-item__video';
      wrap.appendChild(vid);
      break;
    }
    case 'note': {
      const c = item.content as { text: string };
      const p = document.createElement('p');
      p.className = 'media-item__note-text'; p.textContent = c.text;
      const auth = document.createElement('p');
      auth.className = 'media-item__author'; auth.textContent = `— @${item.author.displayName}`;
      wrap.appendChild(p); wrap.appendChild(auth);
      break;
    }
    case 'link': {
      const c = item.content as { url: string; title: string | null; description: string | null; thumbnail: string | null; siteName: string | null };
      if (c.thumbnail) {
        const img = document.createElement('img');
        img.src = c.thumbnail; img.alt = c.title ?? ''; img.className = 'media-item__image';
        wrap.appendChild(img);
      }
      const meta = document.createElement('div');
      meta.className = 'media-item__link-meta';
      if (c.title)       { const t = document.createElement('p'); t.className = 'media-item__link-title'; t.textContent = c.title; meta.appendChild(t); }
      if (c.description) { const d = document.createElement('p'); d.className = 'media-item__link-desc'; d.textContent = c.description; meta.appendChild(d); }
      if (c.siteName)    { const s = document.createElement('p'); s.className = 'media-item__link-site'; s.textContent = c.siteName; meta.appendChild(s); }
      wrap.appendChild(meta);
      break;
    }
    case 'youtube': {
      const c = item.content as { youtubeId: string; title: string };
      const iframe = document.createElement('iframe');
      iframe.className = 'media-item__youtube';
      iframe.dataset['youtubeId'] = c.youtubeId;
      iframe.allow = 'autoplay; fullscreen';
      iframe.setAttribute('frameborder', '0');
      iframe.title = c.title;
      wrap.appendChild(iframe);
      break;
    }
  }
  return wrap;
}

function renderCaption(item: MediaItem): HTMLElement {
  const el = document.createElement('div');
  el.className = 'jam-caption';
  if (item.type === 'note') {
    el.textContent = (item.content as { text: string }).text;
  } else if (hasCaption(item.content)) {
    el.textContent = (item.content as { caption: string | null }).caption!;
  }
  return el;
}

// ─── SceneEngine ──────────────────────────────────────────────────────────────

export class SceneEngine {
  // Callbacks set by SceneCompositor
  onSceneEnd:       ((primary: MediaItem) => void) | null = null;
  onCompanionEnd:   ((companion: MediaItem) => void) | null = null;
  onPrefetchNeeded: (() => void) | null = null;

  // Exposed read-only state
  get activePrimary():   MediaItem | null { return this._primary; }
  get activeCompanion(): MediaItem | null { return this._companion; }

  private layer!: HTMLElement;
  private mounted = false;

  private _primary:   MediaItem | null = null;
  private _companion: MediaItem | null = null;
  private currentLayout: LayoutName = 'IDLE';
  private lastLayoutChange = 0;

  private sceneTimer:     ReturnType<typeof setTimeout> | null = null;
  private companionTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchTimer:  ReturnType<typeof setTimeout> | null = null;
  private graceTimer:     ReturnType<typeof setTimeout> | null = null;

  // YouTube singleton
  private ytPlayer:   YTPlayer | null = null;
  private ytWatchdog: ReturnType<typeof setTimeout> | null = null;
  private ytItem:     MediaItem | null = null;

  mount(layer: HTMLElement): void {
    this.layer = layer;
    this.mounted = true;
    this.applyLayout('IDLE');
  }

  // ── Public scene control ──────────────────────────────────────────────────

  playPrimary(item: MediaItem, durationMs: number): void {
    if (!this.mounted) return;

    this._primary = item;
    this.clearSceneTimers();
    this.recompose();

    // Show attribution via callback (handled by compositor)

    if (item.type === 'youtube') {
      this.mountYoutube(item);
      // Duration driven by youtube ended event — no fixed timer
      return;
    }

    // Prefetch signal 2s before end
    if (durationMs > ENGINE_CONFIG.PREFETCH_LEAD + 500) {
      this.prefetchTimer = setTimeout(() => {
        this.prefetchTimer = null;
        if (this.mounted) this.onPrefetchNeeded?.();
      }, durationMs - ENGINE_CONFIG.PREFETCH_LEAD);
    }

    // Scene timer
    this.sceneTimer = setTimeout(() => {
      this.sceneTimer = null;
      if (!this.mounted || !this._primary) return;
      const finished = this._primary;
      this._primary = null;

      // Stop companion without marking it displayed
      this.clearCompanion();

      // Grace period before layout collapses
      this.graceTimer = setTimeout(() => {
        this.graceTimer = null;
        if (!this.mounted) return;
        this.recompose();
        this.onSceneEnd?.(finished);
      }, ENGINE_CONFIG.GRACE_PERIOD);
    }, durationMs);
  }

  playCompanion(item: MediaItem, durationMs: number): void {
    if (!this.mounted) return;
    this.clearCompanionTimer();

    this._companion = item;
    this.recompose();

    this.companionTimer = setTimeout(() => {
      this.companionTimer = null;
      if (!this.mounted || !this._companion) return;
      const finished = this._companion;
      this._companion = null;
      this.recompose();
      this.onCompanionEnd?.(finished);
    }, durationMs);
  }

  // Stop companion without firing onCompanionEnd (scene ended first)
  clearCompanion(): void {
    this.clearCompanionTimer();
    this._companion = null;
  }

  clearAll(): void {
    this.clearSceneTimers();
    this.clearCompanionTimer();
    if (this.graceTimer !== null) { clearTimeout(this.graceTimer); this.graceTimer = null; }
    this._primary = null;
    this._companion = null;
    this.destroyYoutube();
    this.applyLayout('IDLE');
  }

  destroy(): void {
    this.mounted = false;
    this.clearAll();
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  private recompose(): void {
    const layout = resolveLayout(this._primary, this._companion);
    this.applyLayout(layout);
  }

  private applyLayout(layout: LayoutName): void {
    const now = Date.now();
    if (layout === this.currentLayout && now - this.lastLayoutChange < ENGINE_CONFIG.MIN_SCENE_DURATION) {
      return;
    }

    // Remove old layout class
    if (this.currentLayout !== 'IDLE') {
      this.layer.classList.remove(layoutClass(this.currentLayout));
    }
    this.layer.className = `scene-layer ${layoutClass(layout)}`;
    this.currentLayout = layout;
    this.lastLayoutChange = now;

    this.renderSlots();
  }

  private renderSlots(): void {
    // Remove all existing slots
    this.layer.querySelectorAll('.jam-slot').forEach(s => s.remove());

    const layout = this.currentLayout;
    const primary = this._primary;
    const companion = this._companion;

    if (layout === 'IDLE' || !primary) return;

    const primarySlot = this.slot('primary');
    primarySlot.appendChild(renderItem(primary));
    this.layer.appendChild(primarySlot);

    if (layout === 'MEDIA_FULL') {
      this.mountYoutube(primary);
      return;
    }

    if (layout === 'MEDIA_WITH_CAPTION') {
      const cap = this.slot('caption');
      cap.appendChild(companion ? renderCaption(companion) : renderCaption(primary));
      this.layer.appendChild(cap);
      this.mountYoutube(primary);
      return;
    }

    if (layout === 'VISUAL_FULL' || layout === 'NOTE_CARD') return;

    if (layout === 'VISUAL_WITH_CAPTION') {
      const cap = this.slot('caption');
      cap.appendChild(companion ? renderCaption(companion) : renderCaption(primary));
      this.layer.appendChild(cap);
      return;
    }

    if (layout === 'MEDIA_WITH_VISUAL' && companion) {
      const compSlot = this.slot('secondary');
      compSlot.appendChild(renderItem(companion));
      this.layer.appendChild(compSlot);
      this.mountYoutube(primary);
      return;
    }
  }

  private slot(role: 'primary' | 'secondary' | 'caption'): HTMLElement {
    const el = document.createElement('div');
    el.className = `jam-slot jam-slot--${role}`;
    return el;
  }

  // ── YouTube singleton ─────────────────────────────────────────────────────

  private mountYoutube(item: MediaItem): void {
    if (!this.mounted || item.type !== 'youtube') return;
    const c = item.content as { youtubeId: string; title: string };
    const iframe = this.layer.querySelector<HTMLIFrameElement>('.media-item__youtube');
    if (!iframe) return;

    // Reuse player if same video, else reload
    if (this.ytPlayer && this.ytItem?.type === 'youtube') {
      const oldId = (this.ytItem.content as { youtubeId: string }).youtubeId;
      if (oldId === c.youtubeId) return; // same video — nothing to do
      try { this.ytPlayer.loadVideoById(c.youtubeId); }
      catch { this.destroyYoutube(); this.createYoutube(iframe, c.youtubeId, item); }
    } else {
      this.destroyYoutube();
      this.createYoutube(iframe, c.youtubeId, item);
    }
    this.ytItem = item;
  }

  private createYoutube(iframe: HTMLIFrameElement, videoId: string, item: MediaItem): void {
    try {
      this.ytPlayer = new YT.Player(iframe, {
        height: '100%', width: '100%',
        videoId,
        playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (!this.mounted) return;
            if (e.data === YT.PlayerState.ENDED) {
              const finished = item;
              this._primary = null;
              this.clearCompanion();
              this.recompose();
              this.onSceneEnd?.(finished);
            }
          },
        },
      });

      // Watchdog: skip if not PLAYING after YT_WATCHDOG ms
      if (this.ytWatchdog) { clearTimeout(this.ytWatchdog); }
      this.ytWatchdog = setTimeout(() => {
        this.ytWatchdog = null;
        if (!this.mounted) return;
        try {
          if (this.ytPlayer && this.ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
            const skipped = item;
            this._primary = null;
            this.clearCompanion();
            this.recompose();
            this.onSceneEnd?.(skipped);
          }
        } catch {
          const skipped = item;
          this._primary = null;
          this.clearCompanion();
          this.recompose();
          this.onSceneEnd?.(skipped);
        }
      }, ENGINE_CONFIG.YT_WATCHDOG);
    } catch {
      // YT API not available
      const skipped = item;
      this._primary = null;
      this.recompose();
      this.onSceneEnd?.(skipped);
    }
  }

  private destroyYoutube(): void {
    if (this.ytWatchdog) { clearTimeout(this.ytWatchdog); this.ytWatchdog = null; }
    if (this.ytPlayer) {
      try { this.ytPlayer.stopVideo(); this.ytPlayer.destroy(); } catch { /* already dead */ }
      this.ytPlayer = null;
    }
    this.ytItem = null;
  }

  // ── Timer helpers ─────────────────────────────────────────────────────────

  private clearSceneTimers(): void {
    if (this.sceneTimer)    { clearTimeout(this.sceneTimer);    this.sceneTimer    = null; }
    if (this.prefetchTimer) { clearTimeout(this.prefetchTimer); this.prefetchTimer = null; }
  }

  private clearCompanionTimer(): void {
    if (this.companionTimer) { clearTimeout(this.companionTimer); this.companionTimer = null; }
  }
}
