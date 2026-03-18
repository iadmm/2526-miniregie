<script lang="ts">
  import { api } from '../lib/api.ts';
  import { socketState } from '../lib/socket.svelte.ts';
  import type { MediaItem, MediaStatus, MediaType } from '@shared/types';

  // ─── State ──────────────────────────────────────────────────────────────────

  let items = $state<MediaItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let filterStatus = $state<MediaStatus | 'all'>('all');
  let searchAuthor = $state('');

  // ─── Derived filtered list ───────────────────────────────────────────────────

  const filtered = $derived(
    items.filter((item) => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (searchAuthor.trim()) {
        const q = searchAuthor.trim().toLowerCase();
        if (
          !item.author.displayName.toLowerCase().includes(q) &&
          !item.author.team.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    }),
  );

  // Score lookup from queueSnapshot
  const scoreMap = $derived(() => {
    const m = new Map<string, number>();
    const snapshot = socketState.globalState?.pool.queueSnapshot ?? [];
    for (const item of snapshot) {
      // queueSnapshot items don't carry score directly; we just mark presence
      // The score is computed server-side — we show rank position instead
      m.set(item.id, snapshot.indexOf(item) + 1);
    }
    return m;
  });

  // ─── Load ────────────────────────────────────────────────────────────────────

  async function loadItems(): Promise<void> {
    try {
      items = await api.items.list();
    } catch (err) {
      const apiErr = err as { error?: string };
      error = apiErr.error ?? 'Erreur de chargement.';
    } finally {
      loading = false;
    }
  }

  // Reload on socket state events
  $effect(() => {
    // Trigger refresh whenever globalState changes
    void socketState.globalState;
    void loadItems();
  });

  // ─── Actions ─────────────────────────────────────────────────────────────────

  let actionLoading = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  async function doItemAction(id: string, fn: () => Promise<unknown>): Promise<void> {
    actionLoading = id;
    actionError = null;
    try {
      await fn();
      await loadItems();
    } catch (err) {
      const apiErr = err as { error?: string };
      actionError = apiErr.error ?? 'Erreur.';
    } finally {
      actionLoading = null;
    }
  }

  function togglePin(item: MediaItem): void {
    doItemAction(item.id, () => api.items.updatePin(item.id, !item.pinned));
  }

  function handleStatusChange(item: MediaItem, newStatus: string): void {
    doItemAction(item.id, () => api.items.updateStatus(item.id, newStatus as MediaStatus));
  }

  function deleteItem(item: MediaItem): void {
    if (!confirm(`Supprimer cet item de ${item.author.displayName} ? Cette action est irréversible.`)) return;
    doItemAction(item.id, () => api.items.delete(item.id));
  }

  // ─── Formatting helpers ───────────────────────────────────────────────────────

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
    if ('text' in c && typeof c['text'] === 'string') return c['text'].slice(0, 60);
    if ('title' in c && typeof c['title'] === 'string') return c['title'].slice(0, 60);
    if ('url' in c && typeof c['url'] === 'string') return (c['url'] as string).slice(0, 60);
    if ('youtubeId' in c) return `youtube:${c['youtubeId']}`;
    return '—';
  }

  function formatRelTime(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "A l'instant";
    if (m < 60) return `Il y a ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    return `Il y a ${Math.floor(h / 24)}j`;
  }
</script>

<div class="panel">
  <!-- Filters -->
  <div class="toolbar">
    <div class="filters">
      <select bind:value={filterStatus} class="filter-select">
        <option value="all">Tous les statuts</option>
        <option value="pending">Pending</option>
        <option value="ready">Ready</option>
        <option value="evicted">Evicted</option>
      </select>

      <input
        type="text"
        bind:value={searchAuthor}
        placeholder="Rechercher par auteur…"
        class="search-input"
      />
    </div>

    <span class="item-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
  </div>

  {#if actionError}
    <div class="error-msg" style="margin-bottom: 8px;">{actionError}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if filtered.length === 0}
    <div class="loading">Aucun item.</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Auteur</th>
            <th>Contenu</th>
            <th>Statut</th>
            <th>Queue</th>
            <th>Soumis</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as item (item.id)}
            {@const inQueue = scoreMap().has(item.id)}
            <tr class:pinned={item.pinned}>
              <td class="col-type" title={item.type}>
                <span class="type-icon">{getTypeIcon(item.type)}</span>
              </td>
              <td class="col-author">
                <span class="author-name">{item.author.displayName}</span>
                {#if item.author.team}
                  <span class="author-team">{item.author.team}</span>
                {/if}
              </td>
              <td class="col-content">
                <span class="content-preview">{getContentPreview(item)}</span>
                {#if item.pinned}
                  <span class="pin-badge">📌 épinglé</span>
                {/if}
              </td>
              <td class="col-status">
                <span class="badge badge-{item.status}">{item.status}</span>
              </td>
              <td class="col-queue">
                {#if inQueue}
                  <span class="queue-rank">#{scoreMap().get(item.id)}</span>
                {:else}
                  <span class="text-dim">—</span>
                {/if}
              </td>
              <td class="col-time">
                <span title={new Date(item.submittedAt).toLocaleString()}>
                  {formatRelTime(item.submittedAt)}
                </span>
              </td>
              <td class="col-actions">
                <div class="actions-row">
                  <!-- Pin/Unpin -->
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => togglePin(item)}
                    disabled={actionLoading === item.id}
                    title={item.pinned ? 'Désépingler' : 'Épingler'}
                  >
                    {item.pinned ? '📌' : '📎'}
                  </button>

                  <!-- Status dropdown -->
                  <select
                    class="status-select"
                    value={item.status}
                    onchange={(e) => handleStatusChange(item, (e.target as HTMLSelectElement).value)}
                    disabled={actionLoading === item.id}
                  >
                    <option value="pending">pending</option>
                    <option value="ready">ready</option>
                    <option value="evicted">evicted</option>
                  </select>

                  <!-- Delete -->
                  <button
                    class="btn btn-danger btn-sm"
                    onclick={() => deleteItem(item)}
                    disabled={actionLoading === item.id}
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .panel {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-select,
  .search-input {
    font-size: 13px;
    padding: 6px 10px;
    min-width: 140px;
  }

  .item-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .col-type { width: 40px; text-align: center; }
  .col-author { min-width: 120px; }
  .col-content { max-width: 240px; }
  .col-status { width: 90px; }
  .col-queue { width: 60px; }
  .col-time { width: 90px; font-size: 12px; color: var(--text-muted); }
  .col-actions { width: 200px; }

  .type-icon { font-size: 16px; }

  .author-name { display: block; font-weight: 500; }
  .author-team {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 1px;
  }

  .content-preview {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .pin-badge {
    display: inline-block;
    font-size: 10px;
    color: var(--warning);
    margin-left: 4px;
  }

  .queue-rank {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }

  .text-dim { color: var(--text-dim); font-size: 12px; }

  .actions-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-select {
    font-size: 11px;
    padding: 3px 6px;
  }

  tr.pinned td {
    background: rgba(26, 192, 215, 0.05);
  }
</style>