<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import type { MediaItem, MediaType } from '@shared/types';

  const TYPE_ICONS: Record<MediaType, string> = {
    photo: '🖼',
    gif: '🎞',
    note: '📝',
    clip: '🎬',
    link: '🔗',
    youtube: '▶',
    interview: '🎤',
    ticker: '📡',
  };

  function getTypeIcon(type: MediaType): string {
    return TYPE_ICONS[type] ?? '?';
  }

  function getContentPreview(item: MediaItem): string {
    const c = item.content as Record<string, unknown>;
    if ('text' in c && typeof c['text'] === 'string') return c['text'].slice(0, 80);
    if ('title' in c && typeof c['title'] === 'string') return c['title'].slice(0, 80);
    if ('url' in c && typeof c['url'] === 'string') return (c['url'] as string).slice(0, 80);
    return '—';
  }

  const prettyState = $derived(
    socketState.globalState ? JSON.stringify(socketState.globalState, null, 2) : 'En attente de données…',
  );

  const queueSnapshot = $derived(socketState.globalState?.pool.queueSnapshot ?? []);
</script>

<div class="panel">
  <div class="two-col">
    <!-- Left: GlobalState JSON -->
    <div class="section">
      <div class="section-header">
        <h3>GlobalState live</h3>
        <span class="badge {socketState.connected ? 'badge-running' : 'badge-idle'}">
          {socketState.connected ? 'connecté' : 'déconnecté'}
        </span>
      </div>
      <pre class="state-json">{prettyState}</pre>
    </div>

    <!-- Right: Queue snapshot -->
    <div class="section">
      <div class="section-header">
        <h3>Queue snapshot (top {queueSnapshot.length})</h3>
        <span class="pool-stats">
          Total: {socketState.globalState?.pool.total ?? 0} |
          Fresh: {socketState.globalState?.pool.fresh ?? 0}
        </span>
      </div>

      {#if queueSnapshot.length === 0}
        <div class="empty">Pool vide ou en attente.</div>
      {:else}
        <div class="queue-cards">
          {#each queueSnapshot as item, i (item.id)}
            <div class="queue-card">
              <div class="queue-card-rank">#{i + 1}</div>
              <div class="queue-card-icon">{getTypeIcon(item.type)}</div>
              <div class="queue-card-info">
                <div class="queue-card-author">
                  <strong>{item.author.displayName}</strong>
                  {#if item.author.team}
                    <span class="author-team">{item.author.team}</span>
                  {/if}
                </div>
                <div class="queue-card-content">{getContentPreview(item)}</div>
                <div class="queue-card-meta">
                  <span class="badge badge-{item.status}">{item.status}</span>
                  {#if item.pinned}
                    <span class="pin-indicator">📌</span>
                  {/if}
                  <span class="item-id">{item.id.slice(0, 8)}…</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .panel {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .two-col {
      grid-template-columns: 1fr;
    }
  }

  .section {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-raised);
  }

  .section-header h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pool-stats {
    font-size: 12px;
    color: var(--text-muted);
  }

  .state-json {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    color: var(--text);
    padding: 16px;
    overflow-x: auto;
    white-space: pre;
    max-height: calc(100vh - 220px);
    overflow-y: auto;
  }

  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .queue-cards {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .queue-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }

  .queue-card:last-child {
    border-bottom: none;
  }

  .queue-card:hover {
    background: var(--bg-hover);
  }

  .queue-card-rank {
    font-size: 18px;
    font-weight: 800;
    color: var(--accent);
    min-width: 32px;
    text-align: center;
    line-height: 1;
    padding-top: 2px;
  }

  .queue-card-icon {
    font-size: 20px;
    line-height: 1;
    padding-top: 1px;
  }

  .queue-card-info {
    flex: 1;
    min-width: 0;
  }

  .queue-card-author {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 13px;
    margin-bottom: 3px;
  }

  .author-team {
    font-size: 11px;
    color: var(--text-muted);
  }

  .queue-card-content {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    margin-bottom: 6px;
  }

  .queue-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pin-indicator {
    font-size: 12px;
  }

  .item-id {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-dim);
  }
</style>