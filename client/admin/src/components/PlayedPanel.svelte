<script lang="ts">
  import { onMount } from 'svelte';
  import { socket, socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import type { MediaItem } from '@shared/types';

  type PlayedItem = MediaItem & { playedAt: number };

  let items   = $state<PlayedItem[]>([]);
  let loading = $state(false);
  let error   = $state<string | null>(null);

  const TYPE_LABEL: Record<string, string> = {
    photo: 'photo', gif: 'gif', note: 'note', clip: 'clip',
    ticker: 'ticker', youtube: 'yt', link: 'link', interview: 'intv',
  };

  const TYPE_COLOR: Record<string, string> = {
    photo:     'var(--accent)',
    gif:       '#a855f7',
    note:      'var(--warning)',
    clip:      'var(--ready)',
    ticker:    'var(--accent-dim)',
    youtube:   'var(--live)',
    link:      'var(--text-muted)',
    interview: '#06b6d4',
  };

  function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1_000);
    if (s < 60)  return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  }

  function itemLabel(item: PlayedItem): string {
    const c = item.content as Record<string, unknown>;
    if (typeof c.text === 'string') return c.text.slice(0, 60);
    if (typeof c.caption === 'string' && c.caption) return c.caption.slice(0, 60);
    if (typeof c.title === 'string') return c.title.slice(0, 60);
    return '—';
  }

  async function loadItems() {
    loading = true;
    error = null;
    try {
      items = await api.items.listPlayed();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function requeue(id: string) {
    await api.items.requeue(id);
    loadItems();
  }

  onMount(() => {
    loadItems();
    socket.on('state', loadItems);
    return () => { socket.off('state', loadItems); };
  });
</script>

<div class="played-panel">
  <div class="played-panel__header panel-header">
    <span class="panel-label">Played</span>
    <div class="played-panel__indicators">
      {#if loading}
        <span class="played-panel__loading">…</span>
      {/if}
      {#if items.length > 0}
        <span class="played-panel__count">{items.length}</span>
      {/if}
    </div>
  </div>

  <div class="played-panel__body panel-body">
    {#if error}
      <div class="error-msg" style="margin:8px">{error}</div>
    {:else if items.length === 0 && !loading}
      <p class="played-panel__empty">Nothing played yet.</p>
    {:else}
      {#each items as item (item.id)}
        <div class="played-item">
          <div class="played-item__meta">
            <span class="played-item__type" style="color:{TYPE_COLOR[item.type] ?? 'var(--text-muted)'}">
              {TYPE_LABEL[item.type] ?? item.type}
            </span>
            <span class="played-item__author">{item.author.displayName}</span>
            <span class="played-item__age">{timeAgo(item.playedAt)}</span>
          </div>
          <div class="played-item__label">{itemLabel(item)}</div>
          <button class="played-item__requeue" onclick={() => requeue(item.id)}>
            Re-queue
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .played-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .played-panel__indicators {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .played-panel__loading {
    font-size: 10px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .played-panel__count {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    background: var(--bg-surface);
    padding: 1px 6px;
    border-radius: var(--radius);
  }

  .played-panel__empty {
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    margin-top: 32px;
  }

  .played-panel__body {
    overflow-y: auto;
  }

  .played-item {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 2px 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border-dim);
  }

  .played-item__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    grid-column: 1;
    grid-row: 1;
  }

  .played-item__requeue {
    grid-column: 2;
    grid-row: 1 / 3;
    align-self: center;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    padding: 3px 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.1s, border-color 0.1s;
  }

  .played-item__requeue:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .played-item__type {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .played-item__author {
    font-size: 11px;
    color: var(--text-primary);
  }

  .played-item__age {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-dim);
    margin-left: auto;
  }

  .played-item__label {
    grid-column: 1;
    grid-row: 2;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
