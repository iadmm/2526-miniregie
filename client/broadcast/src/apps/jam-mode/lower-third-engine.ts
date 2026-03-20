// LowerThirdEngine — manages #lower-third-layer.
//
// Attribution band: slide-in from bottom → hold ATTRIBUTION_HOLD ms → slide-out.
//   Follows primary item only.
//   YouTube: title + author·team. Others: author·team + role.
//
// Ticker band: round-robin on items of type 'ticker' from queue.main snapshot.
//   Breaking-news mode when content.label is non-null (height ~15%).

import type { MediaItem, TickerContent } from '@shared/types';
import { ENGINE_CONFIG } from './engine-config.js';

export class LowerThirdEngine {
  private readonly layer: HTMLElement;
  private readonly attributionEl: HTMLElement;
  private readonly tickerEl: HTMLElement;
  private tickerContentEl: HTMLElement;

  private attributionTimer: ReturnType<typeof setTimeout> | null = null;
  private tickerItems: MediaItem[] = [];
  private tickerCursor = 0;

  constructor(layer: HTMLElement) {
    this.layer = layer;

    // Attribution band (hidden initially)
    this.attributionEl = document.createElement('div');
    this.attributionEl.className = 'attribution-band attribution-band--hidden';
    layer.appendChild(this.attributionEl);

    // Ticker band
    this.tickerEl = document.createElement('div');
    this.tickerEl.className = 'ticker-band';
    this.tickerEl.style.display = 'none';

    const label = document.createElement('span');
    label.className = 'ticker-band__label';
    label.textContent = '▸ JOSÉ';

    this.tickerContentEl = document.createElement('span');
    this.tickerContentEl.className = 'ticker-band__content';

    this.tickerEl.appendChild(label);
    this.tickerEl.appendChild(this.tickerContentEl);
    layer.appendChild(this.tickerEl);
  }

  // ── Attribution band ────────────────────────────────────────────────────────

  showAttribution(item: MediaItem): void {
    // Cancel any running hold timer
    if (this.attributionTimer !== null) {
      clearTimeout(this.attributionTimer);
      this.attributionTimer = null;
    }

    // Build content
    this.attributionEl.innerHTML = '';

    const nameEl = document.createElement('p');
    nameEl.className = 'attribution-band__name';

    const metaEl = document.createElement('p');
    metaEl.className = 'attribution-band__meta';

    if (item.type === 'youtube') {
      const c = item.content as { title: string };
      nameEl.textContent = c.title;
      metaEl.textContent = `${item.author.displayName} · ${item.author.team}`;
    } else {
      nameEl.textContent = `${item.author.displayName} · ${item.author.team}`;
      metaEl.textContent = item.author.role;
    }

    this.attributionEl.appendChild(nameEl);
    this.attributionEl.appendChild(metaEl);

    // Trigger slide-in
    this.attributionEl.classList.remove('attribution-band--hidden', 'attribution-band--out');
    void this.attributionEl.offsetWidth; // force reflow to restart animation
    this.attributionEl.classList.add('attribution-band--in');

    // Hold then slide-out
    this.attributionTimer = setTimeout(() => {
      this.attributionTimer = null;
      this.attributionEl.classList.remove('attribution-band--in');
      this.attributionEl.classList.add('attribution-band--out');
    }, ENGINE_CONFIG.ATTRIBUTION_HOLD);
  }

  hideAttribution(): void {
    if (this.attributionTimer !== null) {
      clearTimeout(this.attributionTimer);
      this.attributionTimer = null;
    }
    this.attributionEl.className = 'attribution-band attribution-band--hidden';
  }

  // ── Ticker band ─────────────────────────────────────────────────────────────

  updateTicker(snapshot: MediaItem[]): void {
    this.tickerItems = snapshot.filter(i => i.type === 'ticker' && i.status === 'ready');

    if (this.tickerItems.length === 0) {
      this.tickerEl.style.display = 'none';
      return;
    }

    this.tickerEl.style.display = '';
    if (this.tickerCursor >= this.tickerItems.length) this.tickerCursor = 0;
    this.renderTicker();
  }

  private renderTicker(): void {
    if (this.tickerItems.length === 0) return;
    const item = this.tickerItems[this.tickerCursor % this.tickerItems.length];
    if (!item) return;

    const c = item.content as TickerContent;

    // Breaking-news mode: label present → larger height band
    this.tickerEl.classList.toggle('ticker-band--breaking', !!c.label);

    const text = c.label ? `${c.label} — ${c.text}` : c.text;

    // Clone element to reset CSS animation
    const newContent = this.tickerContentEl.cloneNode(false) as HTMLElement;
    newContent.className = 'ticker-band__content';
    newContent.textContent = text;
    newContent.addEventListener('animationend', () => {
      this.tickerCursor = (this.tickerCursor + 1) % (this.tickerItems.length || 1);
      this.renderTicker();
    }, { once: true });

    this.tickerContentEl.replaceWith(newContent);
    this.tickerContentEl = newContent;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.attributionTimer !== null) {
      clearTimeout(this.attributionTimer);
      this.attributionTimer = null;
    }
    this.layer.innerHTML = '';
  }
}
