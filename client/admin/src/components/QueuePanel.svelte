<script lang="ts">
  import { onMount } from 'svelte';
  import { socket, socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import type { ScoredMediaItem } from '@shared/types';
  import QueueItem from './QueueItem.svelte';

  let items    = $state<ScoredMediaItem[]>([]);
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
  // FIFO: admin drag order (priority DESC), then submission order
  const sorted    = $derived([...items].sort((a, b) =>
    b.priority !== a.priority ? b.priority - a.priority : a.submittedAt - b.submittedAt,
  ));

  const displayItems = $derived((): ScoredMediaItem[] => {
    if (draggedId === null || dropTargetId === null || draggedId === dropTargetId) {
      return sorted;
    }
    const dragged = sorted.find(i => i.id === draggedId);
    if (!dragged) return sorted;
    const without   = sorted.filter(i => i.id !== draggedId);
    const targetIdx = without.findIndex(i => i.id === dropTargetId);
    if (targetIdx === -1) return sorted;
    const insertAt = dropBefore ? targetIdx : targetIdx + 1;
    const result = [...without];
    result.splice(insertAt, 0, dragged);
    return result;
  });

  // ─── Priority assignment ──────────────────────────────────────────────────────
  //
  // Items get priorities spaced by STEP=1, descending from MAX=899 to BASE=100.
  // Supports up to 799 drag-ordered slots.

  const PRIORITY_MAX  = 899;
  const PRIORITY_STEP = 1;
  const PRIORITY_BASE = 100;

  function computePriorityMap(ordered: ScoredMediaItem[]): Map<string, number> {
    const map = new Map<string, number>();
    ordered.forEach((item, idx) => {
      map.set(item.id, Math.max(PRIORITY_BASE, PRIORITY_MAX - idx * PRIORITY_STEP));
    });
    return map;
  }

  // ─── Data fetching ────────────────────────────────────────────────────────────

  async function loadItems() {
    loading = true;
    error = null;
    try {
      const result = await api.items.list({ status: 'ready', scored: true });
      items = result as ScoredMediaItem[];
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

    // Batch-update priorities for all items in the new order
    const priorityMap = computePriorityMap(newOrder);
    const updates = [...priorityMap.entries()].filter(([id, p]) => {
      const current = items.find(i => i.id === id)?.priority;
      return current !== p;
    });

    if (updates.length === 0) return;

    updating = true;
    try {
      await Promise.all(updates.map(([id, priority]) => api.items.update(id, { priority })));
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
      {#if sorted.length > 0}
        <span class="queue-panel__count">{sorted.length}</span>
      {/if}
    </div>
  </div>

  <div class="queue-panel__body panel-body">
    {#if error}
      <div class="error-msg" style="margin:8px">{error}</div>
    {:else if sorted.length === 0 && !loading}
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
