<script lang="ts">
  import { socketState } from '../../lib/socket.svelte.ts';
  import { api, type ApiError } from '../../lib/api.ts';
  import type { AppId } from '@shared/types';

  const APPS: AppId[] = [
    'pre-jam-idle',
    'countdown-to-jam',
    'jam-mode',
    'end-of-countdown',
    'post-jam-idle',
    'micro-trottoir',
  ];

  const broadcast  = $derived(socketState.globalState?.broadcast);
  const jam        = $derived(socketState.globalState?.jam);
  const panicState = $derived(broadcast?.panicState ?? false);
  const jamStatus  = $derived(jam?.status ?? 'idle');

  let resumeAppId  = $state<AppId>('jam-mode');
  let dispatchApp  = $state<AppId>('jam-mode');
  let loading      = $state<string | null>(null); // which action is in flight
  let error        = $state<string | null>(null);

  // Panic message — synced from server, editable at any time
  let panicMessage  = $state('');
  let messageEditing = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Sync from server when not actively editing
  $effect(() => {
    if (!messageEditing) {
      panicMessage = broadcast?.panicMessage ?? '';
    }
  });

  function onMessageInput(e: Event): void {
    panicMessage = (e.target as HTMLTextAreaElement).value;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await api.jam.updateMessage(panicMessage); } catch { /* silent */ }
      saveTimer = null;
    }, 600);
  }

  async function run(key: string, fn: () => Promise<unknown>): Promise<void> {
    loading = key;
    error   = null;
    try {
      await fn();
    } catch (e) {
      error = (e as ApiError).error ?? 'Erreur';
    } finally {
      loading = null;
    }
  }
</script>

<div class="panic-body">

  <!-- ── Panic message ─────────────────────────────────────────────────── -->
  <section class="section">
    <div class="section-title">Message panic (TV)</div>
    <textarea
      class="message-input"
      placeholder="Interlude technique, veuillez patienter…"
      value={panicMessage}
      oninput={onMessageInput}
      onfocus={() => { messageEditing = true; }}
      onblur={() => { messageEditing = false; }}
      rows="3"
    ></textarea>
  </section>

  <!-- ── Panic ─────────────────────────────────────────────────────────── -->
  <section class="section" class:section-alert={panicState}>
    <div class="section-title">
      Panic
      {#if panicState}
        <span class="status-dot dot-panic"></span>
      {/if}
    </div>

    {#if !panicState}
      <button
        class="btn btn-danger btn-full"
        disabled={loading !== null}
        onclick={() => run('panic', () => api.jam.panic())}
      >
        {loading === 'panic' ? '…' : 'Activer le panic'}
      </button>
    {:else}
      <div class="field-row">
        <label class="field-label" for="resume-app">Reprendre sur</label>
        <select id="resume-app" class="select" bind:value={resumeAppId}>
          {#each APPS as app}
            <option value={app}>{app}</option>
          {/each}
        </select>
      </div>
      <button
        class="btn btn-primary btn-full"
        disabled={loading !== null}
        onclick={() => run('clear', () => api.jam.clearPanic(resumeAppId))}
      >
        {loading === 'clear' ? '…' : 'Quitter le panic'}
      </button>
    {/if}
  </section>

  <!-- ── JAM ────────────────────────────────────────────────────────────── -->
  <section class="section">
    <div class="section-title">JAM — <span class="mono">{jamStatus}</span></div>

    <div class="btn-group">
      <button
        class="btn btn-default"
        disabled={loading !== null || jamStatus === 'running'}
        onclick={() => run('start', () => api.jam.start())}
      >
        {loading === 'start' ? '…' : 'Start'}
      </button>
      <button
        class="btn btn-default"
        disabled={loading !== null || jamStatus !== 'running'}
        onclick={() => run('end', () => api.jam.end())}
      >
        {loading === 'end' ? '…' : 'End'}
      </button>
      <button
        class="btn btn-danger-outline"
        disabled={loading !== null}
        onclick={() => run('reset', () => api.jam.reset())}
      >
        {loading === 'reset' ? '…' : 'Reset'}
      </button>
    </div>
  </section>

  <!-- ── Forcer une app ─────────────────────────────────────────────────── -->
  <section class="section">
    <div class="section-title">Forcer une app</div>

    <div class="field-row">
      <label class="field-label" for="dispatch-app">App</label>
      <select id="dispatch-app" class="select" bind:value={dispatchApp}>
        {#each APPS as app}
          <option value={app}>{app}</option>
        {/each}
      </select>
    </div>
    <button
      class="btn btn-default btn-full"
      disabled={loading !== null}
      onclick={() => run('dispatch', () => api.broadcast.dispatch(dispatchApp))}
    >
      {loading === 'dispatch' ? '…' : 'Dispatch'}
    </button>
  </section>

  {#if error}
    <div class="error-bar">{error}</div>
  {/if}

</div>

<style>
  .panic-body {
    display: flex;
    flex-direction: column;
  }

  .section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-dim);
  }

  .section-alert {
    border-left: 2px solid var(--live);
  }

  .section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-panic { background: var(--live); box-shadow: 0 0 4px var(--live); }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 7px;
    gap: 8px;
  }

  .field-label {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .select {
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    padding: 3px 6px;
    font-family: var(--font-mono), monospace;
    flex: 1;
    min-width: 0;
  }

  .btn-group {
    display: flex;
    gap: 6px;
  }

  .btn {
    border-radius: var(--radius);
    font-size: 11px;
    font-weight: 700;
    padding: 5px 10px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: opacity 0.1s;
  }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-full { width: 100%; }

  .btn-default {
    flex: 1;
    background: var(--bg-input, #1a1a1a);
    border-color: var(--border-dim);
    color: var(--text);
  }
  .btn-default:hover:not(:disabled) { background: var(--bg-hover); }

  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.85; }

  .btn-danger {
    background: var(--live);
    color: #fff;
  }
  .btn-danger:hover:not(:disabled) { opacity: 0.85; }

  .btn-danger-outline {
    flex: 1;
    background: transparent;
    border-color: var(--live);
    color: var(--live);
  }
  .btn-danger-outline:hover:not(:disabled) {
    background: color-mix(in srgb, var(--live) 12%, transparent);
  }

  .error-bar {
    padding: 6px 12px;
    font-size: 10px;
    color: var(--danger, #f44336);
  }

  .mono { font-family: var(--font-mono), monospace; }

  .message-input {
    width: 100%;
    resize: vertical;
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    font-family: var(--font), sans-serif;
    padding: 6px 8px;
    line-height: 1.5;
    box-sizing: border-box;
  }
  .message-input:focus {
    outline: none;
    border-color: var(--accent);
  }
</style>