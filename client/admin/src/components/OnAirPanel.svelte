<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import { api, type ApiError } from '../lib/api.ts';
  import type { MediaItem } from '@shared/types';

  const broadcast = $derived(socketState.globalState?.broadcast);
  const pool      = $derived(socketState.globalState?.pool);

  // Resolve active items from queueSnapshot
  const activeItems: MediaItem[] = $derived.by(() => {
    const ids  = broadcast?.activeItemIds ?? [];
    const snap = pool?.queueSnapshot ?? [];
    if (ids.length === 0) return [];
    const byId = new Map(snap.map(i => [i.id, i]));
    return ids.map(id => byId.get(id)).filter((i): i is MediaItem => i !== undefined);
  });

  // Quick inject form
  let tickerText  = $state('');
  let tickerLabel = $state('');
  let noteText    = $state('');
  let sending     = $state<'ticker' | 'note' | null>(null);
  let sendError   = $state<string | null>(null);
  let sendOk      = $state<'ticker' | 'note' | null>(null);

  async function sendTicker(): Promise<void> {
    const text = tickerText.trim();
    if (!text || sending !== null) return;
    sending   = 'ticker';
    sendError = null;
    try {
      await api.items.create({ type: 'ticker', text, label: tickerLabel.trim() || undefined, pinned: true });
      tickerText  = '';
      tickerLabel = '';
      sendOk = 'ticker';
      setTimeout(() => { sendOk = null; }, 2000);
    } catch (e) {
      sendError = (e as ApiError).error ?? 'Error';
    } finally {
      sending = null;
    }
  }

  async function sendNote(): Promise<void> {
    const text = noteText.trim();
    if (!text || sending !== null) return;
    sending   = 'note';
    sendError = null;
    try {
      await api.items.create({ type: 'note', text });
      noteText = '';
      sendOk = 'note';
      setTimeout(() => { sendOk = null; }, 2000);
    } catch (e) {
      sendError = (e as ApiError).error ?? 'Error';
    } finally {
      sending = null;
    }
  }

  function handleTickerKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendTicker(); }
  }

  function handleNoteKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendNote(); }
  }

  function itemTypeIcon(type: MediaItem['type']): string {
    const icons: Record<string, string> = {
      photo: '🖼', gif: 'GIF', clip: '▶', note: '✎',
      link: '🔗', youtube: '▶YT', ticker: '▸',
    };
    return icons[type] ?? type;
  }
</script>

<div class="onair-panel">

  <!-- Left: ON AIR status -->
  <div class="onair-left">
    {#if broadcast?.activeApp}
      <span class="onair-dot" class:live={socketState.globalState?.jam.status === 'running'}></span>
      <span class="onair-label">ON AIR</span>
      <span class="onair-app mono">{broadcast.activeApp}</span>
      {#if broadcast.regime && broadcast.regime !== 'normal'}
        <span class="regime-badge regime-{broadcast.regime}">{broadcast.regime}</span>
      {/if}
    {:else}
      <span class="onair-label muted">—</span>
    {/if}

    <!-- Active items thumbnails -->
    {#if activeItems.length > 0}
      <div class="active-items">
        {#each activeItems as item (item.id)}
          <span class="active-chip" title="{item.type} — {item.author.displayName}">
            <span class="active-chip__icon">{itemTypeIcon(item.type)}</span>
            <span class="active-chip__author">{item.author.displayName}</span>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Right: quick inject forms -->
  <div class="onair-right">

    <!-- Ticker -->
    <div class="inject-group">
      <span class="inject-label">TICKER</span>
      <input
        class="inject-input mono"
        type="text"
        placeholder="Label (opt.)"
        bind:value={tickerLabel}
        maxlength="40"
      />
      <input
        class="inject-input inject-input--main"
        type="text"
        placeholder="Ticker message…"
        bind:value={tickerText}
        maxlength="280"
        onkeydown={handleTickerKey}
      />
      <button
        class="inject-btn"
        class:ok={sendOk === 'ticker'}
        disabled={sending !== null || tickerText.trim().length === 0}
        onclick={() => void sendTicker()}
      >
        {sending === 'ticker' ? '…' : sendOk === 'ticker' ? '✓' : '▸'}
      </button>
    </div>

    <!-- Note -->
    <div class="inject-group">
      <span class="inject-label">NOTE</span>
      <input
        class="inject-input inject-input--main"
        type="text"
        placeholder="Admin note…"
        bind:value={noteText}
        maxlength="280"
        onkeydown={handleNoteKey}
      />
      <button
        class="inject-btn"
        class:ok={sendOk === 'note'}
        disabled={sending !== null || noteText.trim().length === 0}
        onclick={() => void sendNote()}
      >
        {sending === 'note' ? '…' : sendOk === 'note' ? '✓' : '+'}
      </button>
    </div>

    {#if sendError}
      <span class="send-error">{sendError}</span>
    {/if}
  </div>

</div>

<style>
  .onair-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 12px;
    background: #0e0e0e;
    border-bottom: 1px solid var(--border-dim);
    gap: 16px;
    flex-shrink: 0;
    overflow: hidden;
  }

  /* ── Left ────────────────────────────────────────────────────────────── */

  .onair-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }

  .onair-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-dim);
    flex-shrink: 0;
  }

  .onair-dot.live {
    background: var(--live);
    box-shadow: 0 0 6px var(--live);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .onair-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--live);
    flex-shrink: 0;
  }

  .onair-label.muted { color: var(--text-dim); }

  .onair-app {
    font-size: 11px;
    color: var(--accent);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .regime-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .regime-hold   { background: rgba(245,158,11,0.2); color: #f59e0b; }
  .regime-buffer { background: rgba(99,102,241,0.2); color: #818cf8; }

  .active-items {
    display: flex;
    gap: 4px;
    overflow: hidden;
  }

  .active-chip {
    display: flex;
    align-items: center;
    gap: 3px;
    background: var(--bg-active, #1f1f1f);
    border: 1px solid var(--border-dim);
    border-radius: 3px;
    padding: 1px 6px;
    white-space: nowrap;
  }

  .active-chip__icon {
    font-size: 9px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .active-chip__author {
    font-size: 10px;
    color: var(--text-muted);
    max-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Right: inject forms ─────────────────────────────────────────────── */

  .onair-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .inject-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .inject-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    text-transform: uppercase;
    width: 36px;
    flex-shrink: 0;
  }

  .inject-input {
    height: 24px;
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    padding: 0 7px;
    width: 90px;
    transition: border-color 0.1s;
  }

  .inject-input--main { width: 160px; }
  .inject-input.mono  { font-family: var(--font-mono); width: 80px; }

  .inject-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .inject-btn {
    height: 24px;
    width: 28px;
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
    flex-shrink: 0;
  }

  .inject-btn:hover:not(:disabled) {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
  }

  .inject-btn.ok {
    background: var(--ready, #22c55e);
    color: #000;
    border-color: var(--ready, #22c55e);
  }

  .inject-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .send-error {
    font-size: 10px;
    color: var(--live);
    white-space: nowrap;
  }
</style>
