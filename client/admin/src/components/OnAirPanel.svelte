<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import { api, type ApiError } from '../lib/api.ts';
  import type { MediaItem, MediaType } from '@shared/types';

  // ─── Derived state ────────────────────────────────────────────────────────

  const broadcast      = $derived(socketState.globalState?.broadcast);
  const activeItemIds  = $derived(broadcast?.activeItemIds ?? []);
  const regime         = $derived(broadcast?.regime ?? 'normal');
  const queueSnapshot  = $derived(socketState.globalState?.pool.queueSnapshot ?? []);

  // Resolve full MediaItem objects from snapshot by id.
  // Items may not be in snapshot if they were already evicted — fallback to id-only stub.
  const activeItems = $derived<Array<MediaItem | null>>(
    activeItemIds.map(id => queueSnapshot.find(i => i.id === id) ?? null)
  );

  // "Next up": first item in queueSnapshot not currently on-air
  const nextUp = $derived<MediaItem | null>(
    queueSnapshot.find(i => !activeItemIds.includes(i.id) && i.status === 'ready') ?? null
  );

  // Layout name — deduced from active items (mirrors jam-mode logic)
  const layoutName = $derived(resolveLayoutName(activeItemIds.length, activeItems));

  // ─── Error state ──────────────────────────────────────────────────────────

  let evictError = $state<string | null>(null);

  // ─── Layout deduction ─────────────────────────────────────────────────────

  function isVisual(item: MediaItem): boolean {
    if (item.type === 'link') {
      return (item.content as { thumbnail: string | null }).thumbnail !== null;
    }
    return item.type === 'photo' || item.type === 'gif' || item.type === 'clip';
  }

  function isText(item: MediaItem): boolean {
    if (item.type === 'link') {
      return (item.content as { thumbnail: string | null }).thumbnail === null;
    }
    return item.type === 'note';
  }

  function resolveLayoutName(count: number, items: Array<MediaItem | null>): string {
    if (count === 0) return 'IDLE';
    const [a, b, c] = items;
    if (count === 1 && a) {
      if (a.type === 'youtube') return 'MEDIA_FULL / MEDIA_WITH_CAPTION';
      if (isVisual(a)) return 'VISUAL_FULL / VISUAL_WITH_CAPTION';
      if (isText(a)) return 'NOTE_CARD';
    }
    if (count === 2 && a && b) {
      if (a.type === 'youtube') return 'MEDIA_WITH_VISUAL / MEDIA_WITH_CAPTION';
      if (isVisual(a) && b && isVisual(b)) return 'DUAL_VISUAL';
      if (isVisual(a) && b && isText(b)) return 'VISUAL_WITH_CAPTION';
    }
    if (count === 3 && a && b && c) {
      if (a.type === 'youtube' && isVisual(b) && isText(c)) return 'MEDIA_WITH_VISUAL_AND_CAPTION';
    }
    return `${count} item(s)`;
  }

  // ─── Type badge helpers ────────────────────────────────────────────────────

  const TYPE_LABELS: Partial<Record<MediaType, string>> = {
    photo:     'PHOTO',
    gif:       'GIF',
    note:      'NOTE',
    clip:      'CLIP',
    link:      'LINK',
    youtube:   'YT',
    interview: 'INTERVIEW',
    ticker:    'TICKER',
  };

  function typeLabel(t: MediaType): string {
    return TYPE_LABELS[t] ?? t.toUpperCase();
  }

  // ─── Item preview text ────────────────────────────────────────────────────

  function previewText(item: MediaItem): string {
    switch (item.type) {
      case 'note':   return (item.content as { text: string }).text.slice(0, 80);
      case 'ticker': return (item.content as { text: string }).text.slice(0, 80);
      case 'youtube': {
        const c = item.content as { title: string };
        return c.title.slice(0, 80);
      }
      case 'link': {
        const c = item.content as { title: string | null; url: string };
        return (c.title ?? c.url).slice(0, 80);
      }
      case 'photo':
      case 'gif': {
        const c = item.content as { caption: string | null; url: string };
        return c.caption ?? c.url.split('/').pop() ?? '';
      }
      case 'clip': {
        const c = item.content as { caption: string | null; url: string };
        return c.caption ?? c.url.split('/').pop() ?? '';
      }
      default: return '';
    }
  }

  function thumbnailUrl(item: MediaItem): string | null {
    if (item.type === 'youtube') {
      return (item.content as { thumbnail: string }).thumbnail;
    }
    if (item.type === 'photo' || item.type === 'gif') {
      return (item.content as { url: string }).url;
    }
    if (item.type === 'link') {
      return (item.content as { thumbnail: string | null }).thumbnail;
    }
    return null;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function evict(id: string): Promise<void> {
    evictError = null;
    try {
      await api.items.updateStatus(id, 'evicted');
    } catch (e) {
      evictError = (e as ApiError).error ?? 'Erreur';
    }
  }
</script>

<div class="on-air-panel">
  <!-- Header -->
  <div class="panel-header">
    <span class="live-indicator" class:hold={regime === 'hold'} class:buffer={regime === 'buffer'}>
      <span class="live-dot"></span>
      ON AIR
    </span>
    {#if regime === 'hold'}
      <span class="regime-badge badge-hold">HOLD</span>
    {:else if regime === 'buffer'}
      <span class="regime-badge badge-buffer">BUFFER</span>
    {/if}
    {#if activeItemIds.length > 0}
      <span class="layout-name">{layoutName}</span>
    {/if}
  </div>

  <!-- Active items -->
  <div class="items-list">
    {#if activeItemIds.length === 0}
      <div class="empty-state">En attente…</div>
    {:else}
      {#each activeItemIds as id, idx (id)}
        {@const item = activeItems[idx] ?? null}
        <div class="item-row">
          {#if item !== null}
            <!-- Type badge -->
            <span class="type-badge type-{item.type}">{typeLabel(item.type)}</span>

            <!-- Thumbnail (if available) -->
            {#if thumbnailUrl(item) !== null}
              <img
                class="item-thumb"
                src={thumbnailUrl(item)!}
                alt={item.type}
                loading="lazy"
              />
            {/if}

            <!-- Meta -->
            <div class="item-meta">
              <div class="item-author">@{item.author.displayName}</div>
              <div class="item-preview">{previewText(item)}</div>
            </div>

            <!-- Evict -->
            <button
              class="evict-btn"
              title="Evincer"
              onclick={() => evict(id)}
            >
              x
            </button>
          {:else}
            <!-- Item not in snapshot — display truncated id -->
            <span class="type-badge type-unknown">?</span>
            <div class="item-meta">
              <div class="item-preview id-fallback">{id.slice(0, 8)}…</div>
            </div>
            <button
              class="evict-btn"
              title="Evincer"
              onclick={() => evict(id)}
            >
              x
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Error feedback -->
  {#if evictError !== null}
    <div class="error-bar">{evictError}</div>
  {/if}

  <!-- Next up -->
  {#if nextUp !== null}
    <div class="next-up">
      <span class="next-label">Next</span>
      <span class="type-badge type-{nextUp.type}">{typeLabel(nextUp.type)}</span>
      <span class="next-author">@{nextUp.author.displayName}</span>
      <span class="next-preview">{previewText(nextUp)}</span>
    </div>
  {/if}
</div>

<style>
  .on-air-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border-dim);
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */

  .panel-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-dim);
    min-height: 30px;
    flex-shrink: 0;
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--live);
  }

  .live-indicator.hold { color: var(--live); opacity: 0.6; }
  .live-indicator.buffer { color: var(--warning, #f0a030); }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 4px currentColor;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  .regime-badge {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .badge-hold   { background: color-mix(in srgb, var(--live) 15%, transparent); color: var(--live); border: 1px solid color-mix(in srgb, var(--live) 40%, transparent); }
  .badge-buffer { background: color-mix(in srgb, var(--warning, #f0a030) 15%, transparent); color: var(--warning, #f0a030); border: 1px solid color-mix(in srgb, var(--warning, #f0a030) 40%, transparent); }

  .layout-name {
    margin-left: auto;
    font-size: 9px;
    font-family: var(--font-mono), monospace;
    color: var(--text-dim);
  }

  /* ── Items list ──────────────────────────────────────────────────────────── */

  .items-list {
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    padding: 10px 12px;
    font-size: 11px;
    color: var(--text-dim);
    font-style: italic;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-bottom: 1px solid var(--border-dim);
    min-height: 36px;
  }

  .item-row:last-child { border-bottom: none; }

  .type-badge {
    flex-shrink: 0;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid transparent;
    text-transform: uppercase;
  }

  /* Per-type colour accents */
  .type-photo    { background: rgba(66, 153, 225, 0.15);  color: #63b3ed; border-color: rgba(66, 153, 225, 0.3);  }
  .type-gif      { background: rgba(159, 122, 234, 0.15); color: #b794f4; border-color: rgba(159, 122, 234, 0.3); }
  .type-note     { background: rgba(72, 187, 120, 0.15);  color: #68d391; border-color: rgba(72, 187, 120, 0.3);  }
  .type-clip     { background: rgba(237, 137, 54, 0.15);  color: #f6ad55; border-color: rgba(237, 137, 54, 0.3);  }
  .type-link     { background: rgba(99, 179, 237, 0.12);  color: #90cdf4; border-color: rgba(99, 179, 237, 0.3);  }
  .type-youtube  { background: rgba(245, 101, 101, 0.15); color: #fc8181; border-color: rgba(245, 101, 101, 0.3); }
  .type-interview{ background: rgba(246, 173, 85, 0.15);  color: #f6ad55; border-color: rgba(246, 173, 85, 0.3);  }
  .type-ticker   { background: rgba(129, 230, 217, 0.15); color: #81e6d9; border-color: rgba(129, 230, 217, 0.3); }
  .type-unknown  { background: rgba(160, 174, 192, 0.15); color: #a0aec0; border-color: rgba(160, 174, 192, 0.3); }

  .item-thumb {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
    border: 1px solid var(--border-dim);
  }

  .item-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .item-author {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-preview {
    font-size: 10px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .id-fallback {
    font-family: var(--font-mono), monospace;
    font-size: 9px;
    color: var(--text-dim);
  }

  .evict-btn {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    background: transparent;
    border: 1px solid var(--border-dim);
    border-radius: 3px;
    color: var(--text-dim);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    transition: color 0.1s, border-color 0.1s, background 0.1s;
  }

  .evict-btn:hover {
    color: var(--live);
    border-color: var(--live);
    background: color-mix(in srgb, var(--live) 10%, transparent);
  }

  /* ── Error bar ───────────────────────────────────────────────────────────── */

  .error-bar {
    padding: 4px 12px;
    font-size: 10px;
    color: var(--danger, #f44336);
    background: color-mix(in srgb, var(--danger, #f44336) 8%, transparent);
  }

  /* ── Next up ─────────────────────────────────────────────────────────────── */

  .next-up {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: color-mix(in srgb, var(--accent) 5%, transparent);
    border-top: 1px solid var(--border-dim);
    min-height: 28px;
  }

  .next-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    flex-shrink: 0;
  }

  .next-author {
    font-size: 9px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .next-preview {
    font-size: 10px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
</style>
