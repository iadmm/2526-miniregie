<script lang="ts">
  import { Tabs } from 'bits-ui';
  import { api } from '../lib/api.ts';
  import { socket } from '../lib/socket.svelte.ts';
  import type { MediaItem, MediaStatus } from '@shared/types';

  // ─── Queue tab ────────────────────────────────────────────────────────────
  let items    = $state<MediaItem[]>([]);
  let filter   = $state<MediaStatus | 'all'>('pending');
  let loading  = $state(false);

  const filteredItems = $derived(
    filter === 'all' ? items : items.filter(i => i.status === filter),
  );

  async function loadItems() {
    loading = true;
    try {
      items = await api.items.list();
    } catch { /* ignore */ } finally {
      loading = false;
    }
  }

  async function setStatus(id: string, status: MediaStatus) {
    try {
      await api.items.updateStatus(id, status);
      await loadItems();
    } catch { /* ignore */ }
  }

  async function togglePin(id: string, pinned: boolean) {
    try {
      await api.items.updatePin(id, !pinned);
      await loadItems();
    } catch { /* ignore */ }
  }

  // ─── Create tab ───────────────────────────────────────────────────────────
  let createType   = $state<'note' | 'ticker'>('note');
  let createText   = $state('');
  let createPinned = $state(false);
  let creating     = $state(false);
  let createError  = $state<string | null>(null);

  async function submitCreate() {
    if (!createText.trim()) return;
    creating    = true;
    createError = null;
    try {
      await api.items.create({ type: createType, text: createText.trim(), pinned: createPinned });
      createText   = '';
      createPinned = false;
      await loadItems();
    } catch (e) {
      createError = (e as { error?: string })?.error ?? 'Erreur';
    } finally {
      creating = false;
    }
  }

  // ─── Socket + polling ─────────────────────────────────────────────────────
  $effect(() => {
    loadItems();
    socket.on('pool:item:ready', loadItems);
    const t = setInterval(loadItems, 5000);
    return () => {
      socket.off('pool:item:ready', loadItems);
      clearInterval(t);
    };
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function itemPreview(item: MediaItem): string {
    const c = item.content;
    if ('text' in c) return c.text.slice(0, 60);
    if ('title' in c && c.title) return c.title;
    if ('url' in c) return c.url.slice(0, 50);
    return item.type;
  }
</script>

<div class="source-panel">
  <div class="panel-header">
    <span class="panel-label">Source / Contenu</span>
  </div>

  <Tabs.Root value="queue" class="tabs-root">
    <Tabs.List class="tabs-list">
      <Tabs.Trigger value="queue"  class="tab-trigger">Queue</Tabs.Trigger>
      <Tabs.Trigger value="create" class="tab-trigger">Créer</Tabs.Trigger>
    </Tabs.List>

    <!-- ── Queue tab ── -->
    <Tabs.Content value="queue" class="tab-content queue-tab-content">
      <div class="filter-bar">
        {#each (['pending', 'ready', 'evicted', 'all'] as const) as f}
          <button
            class="filter-btn"
            class:active={filter === f}
            onclick={() => { filter = f; }}
          >{f}</button>
        {/each}
        <span class="item-count">{filteredItems.length}</span>
      </div>

      <div class="item-list">
        {#if loading && items.length === 0}
          <div class="empty">Chargement…</div>
        {:else if filteredItems.length === 0}
          <div class="empty">Aucun item {filter !== 'all' ? `(${filter})` : ''}</div>
        {:else}
          {#each filteredItems as item (item.id)}
            <div class="item-row">
              <div class="item-info">
                <span class="item-type-badge">{item.type}</span>
                <span class="item-author">{item.author.displayName}</span>
                <span class="item-preview">{itemPreview(item)}</span>
              </div>
              <div class="item-actions">
                {#if item.status === 'pending'}
                  <button
                    class="btn-action ready"
                    onclick={() => setStatus(item.id, 'ready')}
                    title="Approuver → ready"
                  >✓</button>
                {:else if item.status === 'ready'}
                  <button
                    class="btn-action evict"
                    onclick={() => setStatus(item.id, 'evicted')}
                    title="Évincer"
                  >✗</button>
                {/if}
                {#if item.status !== 'evicted'}
                  <button
                    class="btn-action pin"
                    class:active={item.pinned}
                    onclick={() => togglePin(item.id, item.pinned)}
                    title={item.pinned ? 'Dépingler' : 'Épingler'}
                  >📌</button>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </Tabs.Content>

    <!-- ── Create tab ── -->
    <Tabs.Content value="create" class="tab-content">
      <div class="create-form">
        {#if createError}
          <div class="form-error">{createError}</div>
        {/if}

        <div class="form-row">
          <label class="form-label" for="create-type">Type</label>
          <select id="create-type" class="select" bind:value={createType}>
            <option value="note">Note</option>
            <option value="ticker">Ticker</option>
          </select>
        </div>

        <div class="form-row col">
          <label class="form-label" for="create-text">
            Texte
            <span class="char-count">{createText.length}/280</span>
          </label>
          <textarea
            id="create-text"
            class="textarea"
            bind:value={createText}
            placeholder={createType === 'ticker' ? 'Texte du ticker…' : 'Contenu de la note…'}
            maxlength={280}
            rows={4}
          ></textarea>
        </div>

        <div class="form-row">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={createPinned} />
            Épingler
          </label>
        </div>

        <button
          class="btn-submit"
          onclick={submitCreate}
          disabled={creating || !createText.trim()}
        >
          {creating ? 'Envoi…' : 'Créer'}
        </button>
      </div>
    </Tabs.Content>
  </Tabs.Root>
</div>

<style>
  .source-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
    overflow: hidden;
  }

  :global(.tabs-root) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  :global(.tabs-list) {
    display: flex;
    border-bottom: 1px solid var(--border-dim);
    background: var(--bg-panel);
    flex-shrink: 0;
  }

  :global(.tab-trigger) {
    flex: 1;
    padding: 7px 10px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  :global(.tab-trigger:hover) { color: var(--text); background: var(--bg-hover); }
  :global(.tab-trigger[data-state="active"]) { color: var(--accent); border-bottom-color: var(--accent); }
  :global(.tab-content) { flex: 1; overflow-y: auto; }

  /* Queue tab override — needs column flex for filter-bar + list */
  :global(.queue-tab-content) {
    display: flex !important;
    flex-direction: column;
    overflow: hidden;
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-dim);
    background: var(--bg-panel);
    flex-shrink: 0;
  }

  .filter-btn {
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--border-dim);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.12s;
  }

  .filter-btn.active  { background: var(--accent); border-color: var(--accent); color: #000; }
  .filter-btn:hover:not(.active) { border-color: var(--border); color: var(--text); }

  .item-count {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-muted);
  }

  /* Item list */
  .item-list {
    flex: 1;
    overflow-y: auto;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-dim);
    transition: background 0.1s;
  }

  .item-row:hover { background: var(--bg-hover); }

  .item-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }

  .item-type-badge {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    background: #333;
    color: var(--text-muted);
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .item-author {
    font-size: 10px;
    color: var(--accent);
    flex-shrink: 0;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-preview {
    font-size: 10px;
    color: var(--text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .item-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .btn-action {
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0.5;
    transition: opacity 0.12s;
  }

  .btn-action:hover { opacity: 1; background: var(--bg-hover); }
  .btn-action.ready { color: #22c55e; }
  .btn-action.evict { color: var(--live); }
  .btn-action.pin.active { opacity: 1; }

  /* Create form */
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 10px;
  }

  .form-error {
    font-size: 10px;
    color: var(--live);
    background: #2d1111;
    padding: 5px 8px;
    border-radius: var(--radius);
  }

  .form-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .form-row.col {
    flex-direction: column;
    align-items: stretch;
  }

  .form-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .char-count { font-weight: 400; text-transform: none; letter-spacing: 0; }

  .select {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    padding: 5px 8px;
    cursor: pointer;
    flex: 1;
  }

  .textarea {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    padding: 6px 8px;
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
    min-height: 80px;
  }

  .textarea:focus { outline: none; border-color: var(--accent); }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .btn-submit {
    padding: 8px 16px;
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: #000;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    align-self: flex-end;
  }

  .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  .empty {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }
</style>
