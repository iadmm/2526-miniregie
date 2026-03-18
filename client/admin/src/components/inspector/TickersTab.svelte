<script lang="ts">
  import { api } from '../../lib/api.ts';
  import type { MediaItem } from '@shared/types';

  let tickers = $state<MediaItem[]>([]);
  let newText  = $state('');
  let adding   = $state(false);
  let error    = $state<string | null>(null);

  async function loadTickers() {
    try {
      const items = await api.items.list();
      tickers = items.filter(i => i.type === 'ticker');
    } catch (e) {
      error = (e as { error?: string })?.error ?? 'Erreur chargement';
    }
  }

  async function addTicker() {
    if (!newText.trim()) return;
    adding = true;
    error  = null;
    try {
      await api.items.create({ type: 'ticker', text: newText.trim() });
      newText = '';
      await loadTickers();
    } catch (e) {
      error = (e as { error?: string })?.error ?? 'Erreur création';
    } finally {
      adding = false;
    }
  }

  async function deleteTicker(id: string) {
    try {
      await api.items.delete(id);
      await loadTickers();
    } catch (e) {
      error = (e as { error?: string })?.error ?? 'Erreur suppression';
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    try {
      await api.items.updatePin(id, !pinned);
      await loadTickers();
    } catch (e) {
      error = (e as { error?: string })?.error ?? 'Erreur pin';
    }
  }

  $effect(() => {
    loadTickers();
  });
</script>

<div class="tickers-tab">
  {#if error}
    <div class="error-bar">{error}</div>
  {/if}

  <!-- Add form -->
  <div class="add-form">
    <input
      class="input flex-1"
      bind:value={newText}
      placeholder="Texte du ticker…"
      maxlength={280}
      onkeydown={(e) => e.key === 'Enter' && addTicker()}
    />
    <button class="btn-add" onclick={addTicker} disabled={adding || !newText.trim()}>
      {adding ? '…' : '+'}
    </button>
  </div>

  <!-- List -->
  <div class="ticker-list">
    {#if tickers.length === 0}
      <div class="empty">Aucun ticker</div>
    {:else}
      {#each tickers as item (item.id)}
        <div class="ticker-row" class:pinned={item.pinned}>
          <span class="ticker-text">
            {'text' in item.content ? item.content.text : ''}
          </span>
          <div class="ticker-actions">
            <button
              class="btn-icon"
              class:active={item.pinned}
              onclick={() => togglePin(item.id, item.pinned)}
              title={item.pinned ? 'Dépingler' : 'Épingler'}
            >📌</button>
            <button
              class="btn-icon danger"
              onclick={() => deleteTicker(item.id)}
              title="Supprimer"
            >×</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .tickers-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .error-bar {
    background: #2d1111;
    color: var(--live);
    font-size: 10px;
    padding: 5px 10px;
    border-bottom: 1px solid var(--live);
    flex-shrink: 0;
  }

  .add-form {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .flex-1 { flex: 1; min-width: 0; }

  .input {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    padding: 5px 8px;
    min-width: 0;
  }

  .input:focus { outline: none; border-color: var(--accent); }

  .btn-add {
    padding: 5px 10px;
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: #000;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    line-height: 1;
  }

  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }

  .ticker-list {
    flex: 1;
    overflow-y: auto;
  }

  .ticker-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-dim);
  }

  .ticker-row.pinned { background: #1a1a0a; }

  .ticker-text {
    flex: 1;
    font-size: 11px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ticker-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .btn-icon {
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
    opacity: 0.35;
    transition: opacity 0.15s;
  }

  .btn-icon:hover    { opacity: 1; background: var(--bg-hover); }
  .btn-icon.active   { opacity: 1; }
  .btn-icon.danger   { color: var(--live); }

  .empty {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }
</style>
