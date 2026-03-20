<script lang="ts">
  import { onMount } from 'svelte';
  import { socket, socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import type { MediaItem } from '@shared/types';
  import QueueItem from './QueueItem.svelte';

  let items    = $state<MediaItem[]>([]);
  let loading  = $state(false);
  let updating = $state(false);
  let error    = $state<string | null>(null);

  // ─── Drag state ───────────────────────────────────────────────────────────────

  let draggedId:    string | null = $state(null);
  let dropTargetId: string | null = $state(null);
  let dropBefore:   boolean       = $state(true);
  let dragActive = false; // non-reactive — guards socket refresh during drag

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const activeIds = $derived(socketState.globalState?.broadcast.activeItemIds ?? []);

  // Items arrive pre-sorted by queuePosition from api.queue.main().
  // displayItems applies the live drag preview on top of that order.
  const displayItems = $derived((): MediaItem[] => {
    if (draggedId === null || dropTargetId === null || draggedId === dropTargetId) {
      return items;
    }
    const dragged = items.find(i => i.id === draggedId);
    if (!dragged) return items;
    const without   = items.filter(i => i.id !== draggedId);
    const targetIdx = without.findIndex(i => i.id === dropTargetId);
    if (targetIdx === -1) return items;
    const insertAt = dropBefore ? targetIdx : targetIdx + 1;
    const result = [...without];
    result.splice(insertAt, 0, dragged);
    return result;
  });

  // ─── Data fetching ────────────────────────────────────────────────────────────

  async function loadItems() {
    loading = true;
    error = null;
    try {
      items = await api.queue.main();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load queue';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadItems();
    socket.on('state', () => { if (!dragActive) loadItems(); });
    return () => { socket.off('state', loadItems); };
  });

  // ─── Drag handlers ────────────────────────────────────────────────────────────

  function onDragStart(id: string) {
    dragActive = true;
    draggedId = id;
  }

  function onDragOver(id: string, before: boolean) {
    if (id === draggedId) return;
    dropTargetId = id;
    dropBefore = before;
  }

  async function onDrop() {
    if (!draggedId || !dropTargetId) { resetDrag(); return; }

    const newOrder = displayItems();
    resetDrag();

    updating = true;
    try {
      await api.queue.reorder(newOrder.map(i => i.id));
    } catch {
      // Best-effort — refresh anyway to get consistent state
    } finally {
      updating = false;
    }
    await loadItems();
  }

  function onDragEnd() { resetDrag(); }

  function resetDrag() {
    dragActive = false;
    draggedId = null;
    dropTargetId = null;
  }
</script>

<div class="queue-panel">
  <div class="queue-panel__header panel-header">
    <span class="panel-label">Queue</span>
    <div class="queue-panel__indicators">
      {#if loading || updating}
        <span class="queue-panel__loading">{updating ? 'saving…' : '…'}</span>
      {/if}
      {#if items.length > 0}
        <span class="queue-panel__count">{items.length}</span>
      {/if}
    </div>
  </div>

  <div class="queue-panel__body panel-body">
    {#if error}
      <div class="error-msg" style="margin:8px">{error}</div>
    {:else if items.length === 0 && !loading}
      <p class="queue-panel__empty">Queue is empty.</p>
    {:else}
      {#each displayItems() as item (item.id)}
        <QueueItem
          {item}
          {activeIds}
          onMutate={loadItems}
          isDragging={draggedId === item.id}
          dropIndicator={dropTargetId === item.id ? (dropBefore ? 'above' : 'below') : null}
          {onDragStart}
          {onDragOver}
          {onDrop}
          {onDragEnd}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .queue-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .queue-panel__indicators {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .queue-panel__loading {
    font-size: 10px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .queue-panel__count {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    background: var(--bg-surface);
    padding: 1px 6px;
    border-radius: var(--radius);
  }

  .queue-panel__empty {
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    margin-top: 32px;
  }
</style>
