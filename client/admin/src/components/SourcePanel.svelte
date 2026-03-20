<script lang="ts">
  import { socket, socketState } from '../lib/socket.svelte.ts';
  import { api, type ApiError } from '../lib/api.ts';
  import type { ScoredMediaItem, AuthorStats } from '@shared/types';
  import QueueItem      from './QueueItem.svelte';
  import MetadataDrawer from './MetadataDrawer.svelte';

  let items       = $state<ScoredMediaItem[]>([]);
  let authorStats = $state<Map<string, AuthorStats>>(new Map());
  let loading     = $state(false);
  let error       = $state<string | null>(null);
  let editItem    = $state<ScoredMediaItem | null>(null);
  let prevTotal   = $state(-1);

  async function load(): Promise<void> {
    if (loading) return;
    loading = true;
    error   = null;
    try {
      const [scored, authors] = await Promise.all([
        api.items.list({ status: 'ready', scored: true }) as Promise<ScoredMediaItem[]>,
        api.pool.authors(),
      ]);
      items       = scored;
      authorStats = new Map(authors.map((a: AuthorStats) => [a.id, a]));
    } catch (e) {
      error = (e as ApiError).error ?? 'Failed to load queue';
    } finally {
      loading = false;
    }
  }

  // Initial load
  $effect(() => { void load(); });

  // Reload when pool total changes (driven by socket state events)
  $effect(() => {
    const total = socketState.globalState?.pool.total ?? -1;
    if (total !== prevTotal) {
      prevTotal = total;
      if (total !== -1) void load();
    }
  });

  // Also reload on new item events
  $effect(() => {
    const handler = () => { void load(); };
    socket.on('pool:item:ready', handler);
    return () => { socket.off('pool:item:ready', handler); };
  });

  async function handlePin(id: string): Promise<void> {
    try {
      await api.items.updatePin(id, true);
      await load();
    } catch (e) {
      error = (e as ApiError).error ?? 'Pin failed';
    }
  }

  async function handleSkip(id: string): Promise<void> {
    try {
      await api.items.skip(id);
      await load();
    } catch (e) {
      error = (e as ApiError).error ?? 'Skip failed';
    }
  }

  async function handleEvict(id: string): Promise<void> {
    try {
      await api.items.updateStatus(id, 'evicted');
      await load();
    } catch (e) {
      error = (e as ApiError).error ?? 'Evict failed';
    }
  }

  async function handleUnban(authorId: string): Promise<void> {
    try {
      await api.participants.unban(authorId);
      await load();
    } catch (e) {
      error = (e as ApiError).error ?? 'Unban failed';
    }
  }

  async function handleSave(id: string, patch: { priority?: number; caption?: string; text?: string }): Promise<void> {
    await api.items.update(id, patch);
    editItem = null;
    await load();
  }
</script>

<div class="source-panel">
  <!-- Header -->
  <div class="panel-header">
    <span class="panel-label">Queue</span>
    <div class="header-right">
      {#if loading}
        <span class="loading-dot">●</span>
      {:else}
        <span class="count">{items.length} items</span>
      {/if}
      <button class="btn btn-ghost btn-xs" onclick={() => void load()} title="Refresh">↺</button>
    </div>
  </div>

  {#if error}
    <div class="error-bar">{error}</div>
  {/if}

  <!-- Queue list -->
  <div class="queue-list" class:has-drawer={editItem !== null}>
    {#if items.length === 0 && !loading}
      <div class="empty">Queue empty</div>
    {:else}
      {#each items as item, i (item.id)}
        <QueueItem
          {item}
          rank={i + 1}
          banned={authorStats.get(item.author.participantId)?.banned ?? false}
          onPin={handlePin}
          onSkip={handleSkip}
          onEvict={handleEvict}
          onUnban={handleUnban}
          onEdit={(it) => { editItem = it; }}
        />
      {/each}
    {/if}
  </div>

  <!-- Metadata drawer (absolute overlay within panel) -->
  {#if editItem !== null}
    <MetadataDrawer
      item={editItem}
      onClose={() => { editItem = null; }}
      onSave={handleSave}
    />
  {/if}
</div>

<style>
  .source-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
    overflow: hidden;
    position: relative; /* anchor for MetadataDrawer */
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .count {
    font-size: 10px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .loading-dot {
    font-size: 8px;
    color: var(--accent);
    animation: blink 1s step-end infinite;
  }

  @keyframes blink { 50% { opacity: 0.3; } }

  .error-bar {
    padding: 5px 10px;
    font-size: 11px;
    color: #f87171;
    background: rgba(229,57,53,0.1);
    border-bottom: 1px solid rgba(229,57,53,0.3);
    flex-shrink: 0;
  }

  .queue-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .queue-list.has-drawer {
    /* leave space so last items aren't hidden under drawer */
    padding-bottom: 220px;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    font-size: 11px;
    color: var(--text-dim);
  }
</style>
