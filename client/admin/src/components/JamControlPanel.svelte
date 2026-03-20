<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import type { AppId } from '@shared/types';

  const APPS: { id: AppId; label: string }[] = [
    { id: 'pre-jam-idle',    label: 'Pre-JAM idle' },
    { id: 'countdown-to-jam', label: 'Countdown' },
    { id: 'jam-mode',        label: 'JAM mode' },
    { id: 'end-of-countdown', label: 'End of countdown' },
    { id: 'post-jam-idle',   label: 'Post-JAM idle' },
    { id: 'micro-trottoir',  label: 'Micro-trottoir' },
  ];

  const jam    = $derived(socketState.globalState?.jam);
  const status = $derived(jam?.status ?? 'idle');

  // END JAM confirmation state
  let confirmEnd = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  // Manual dispatch
  let dispatchApp = $state<AppId>('jam-mode');

  // Time formatting
  function formatTime(ms: number | null): string {
    if (ms === null || ms <= 0) return '00:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }

  async function startJam() {
    await api.jam.start();
  }

  function requestEndJam() {
    confirmEnd = true;
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirmEnd = false; }, 4000);
  }

  async function confirmEndJam() {
    confirmEnd = false;
    if (confirmTimer) clearTimeout(confirmTimer);
    await api.jam.end();
  }

  function cancelEnd() {
    confirmEnd = false;
    if (confirmTimer) clearTimeout(confirmTimer);
  }

  async function resetJam() {
    await api.jam.reset();
  }

  async function dispatch() {
    await api.broadcast.dispatch(dispatchApp);
  }
</script>

<div class="jam-control">

  <!-- Status row -->
  <div class="jam-control__status-row">
    <span class="jam-control__dot jam-control__dot--{status}"></span>
    <span class="jam-control__status-text jam-control__status-text--{status}">
      {status.toUpperCase()}
    </span>
    {#if status === 'running' && jam?.timeRemaining !== undefined}
      <span class="jam-control__timer">{formatTime(jam.timeRemaining)}</span>
    {/if}
  </div>

  <!-- Primary actions -->
  <div class="jam-control__actions">

    {#if status === 'idle'}
      <button class="jam-control__btn jam-control__btn--start" onclick={startJam}>
        START JAM
      </button>

    {:else if status === 'running'}
      {#if confirmEnd}
        <div class="jam-control__confirm">
          <span class="jam-control__confirm-label">End JAM?</span>
          <button class="jam-control__btn jam-control__btn--danger" onclick={confirmEndJam}>Confirm</button>
          <button class="jam-control__btn jam-control__btn--ghost" onclick={cancelEnd}>Cancel</button>
        </div>
      {:else}
        <button class="jam-control__btn jam-control__btn--end" onclick={requestEndJam}>
          END JAM
        </button>
      {/if}

    {:else if status === 'ended'}
      <button class="jam-control__btn jam-control__btn--reset" onclick={resetJam}>
        RESET
      </button>
    {/if}

  </div>

  <!-- Manual dispatch -->
  <div class="jam-control__dispatch">
    <span class="jam-control__dispatch-label">Dispatch</span>
    <select class="jam-control__select" bind:value={dispatchApp}>
      {#each APPS as app}
        <option value={app.id}>{app.label}</option>
      {/each}
    </select>
    <button class="jam-control__btn jam-control__btn--dispatch" onclick={dispatch}>→</button>
  </div>

</div>

<style>
  .jam-control {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    height: 48px;
    background: var(--bg-panel);
    border-top: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  /* ─── Status ─────────────────────────────────────────────────── */

  .jam-control__status-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .jam-control__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .jam-control__dot--idle    { background: var(--text-dim); }
  .jam-control__dot--running { background: var(--ready); box-shadow: 0 0 6px var(--ready); animation: pulse-dot 2s ease-in-out infinite; }
  .jam-control__dot--ended   { background: var(--accent); }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  .jam-control__status-text {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .jam-control__status-text--idle    { color: var(--text-dim); }
  .jam-control__status-text--running { color: var(--ready); }
  .jam-control__status-text--ended   { color: var(--accent); }

  .jam-control__timer {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.05em;
    min-width: 42px;
  }

  /* ─── Actions ────────────────────────────────────────────────── */

  .jam-control__actions {
    flex-shrink: 0;
  }

  .jam-control__confirm {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .jam-control__confirm-label {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .jam-control__btn {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    padding: 5px 12px;
    white-space: nowrap;
  }

  .jam-control__btn--start {
    color: var(--bg-deep);
    background: var(--ready);
    border: 1px solid var(--ready);
  }

  .jam-control__btn--start:hover {
    background: color-mix(in srgb, var(--ready) 80%, #fff 20%);
  }

  .jam-control__btn--end {
    color: var(--danger);
    background: transparent;
    border: 1px solid var(--danger);
  }

  .jam-control__btn--end:hover {
    background: color-mix(in srgb, var(--danger) 15%, transparent 85%);
  }

  .jam-control__btn--danger {
    color: #fff;
    background: var(--danger);
    border: 1px solid var(--danger);
  }

  .jam-control__btn--danger:hover {
    background: color-mix(in srgb, var(--danger) 80%, #fff 20%);
  }

  .jam-control__btn--reset {
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
  }

  .jam-control__btn--reset:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }

  .jam-control__btn--ghost {
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border-dim);
  }

  .jam-control__btn--ghost:hover {
    color: var(--text-muted);
    border-color: var(--border);
  }

  /* ─── Dispatch ───────────────────────────────────────────────── */

  .jam-control__dispatch {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .jam-control__dispatch-label {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .jam-control__select {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    padding: 4px 8px;
    appearance: none;
    max-width: 130px;
  }

  .jam-control__btn--dispatch {
    color: var(--text-muted);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    padding: 4px 10px;
    font-size: 13px;
  }

  .jam-control__btn--dispatch:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }
</style>
