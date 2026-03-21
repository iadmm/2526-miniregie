<script lang="ts">
  import { socketState } from '../../lib/socket.svelte.ts';
  import { api } from '../../lib/api.ts';
  import type { AppId } from '@shared/types';

  const APPS: { id: AppId; label: string }[] = [
    { id: 'pre-jam-idle',    label: 'Pre-JAM idle' },
    { id: 'countdown-to-jam', label: 'Countdown' },
    { id: 'jam-mode',        label: 'JAM mode' },
    { id: 'end-of-countdown', label: 'End of countdown' },
    { id: 'post-jam-idle',   label: 'Post-JAM idle' },
    { id: 'micro-trottoir',  label: 'Micro-trottoir' },
  ];

  const broadcast = $derived(socketState.globalState?.broadcast);
  const isActive  = $derived(broadcast?.panicState ?? false);

  let resumeApp   = $state<AppId>('jam-mode');
  let message     = $state('');
  let msgTimer:   ReturnType<typeof setTimeout> | null = null;

  // Sync message input from server state on first load
  $effect(() => {
    const serverMsg = broadcast?.panicMessage ?? '';
    if (!isActive) message = serverMsg;
  });

  async function activate() {
    await api.jam.panic();
  }

  async function clear() {
    await api.jam.clearPanic(resumeApp);
    message = '';
  }

  function onMessageInput() {
    if (!isActive) return;
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { api.jam.updateMessage(message); }, 400);
  }
</script>

<div class="panic-panel">
  <div class="panic-panel__header panel-header">
    <span class="panel-label">Panic</span>
    {#if isActive}
      <span class="panic-panel__badge">ACTIVE</span>
    {/if}
  </div>

  <div class="panic-panel__body">

    <!-- Trigger -->
    <button
      class="panic-panel__trigger"
      class:panic-panel__trigger--active={isActive}
      onclick={activate}
      disabled={isActive}
    >
      {isActive ? 'PANIC ACTIVE' : 'PANIC'}
    </button>

    <!-- Message -->
    <div class="panic-panel__section">
      <label class="panic-panel__label" for="panic-msg">Message on screen</label>
      <textarea
        id="panic-msg"
        class="panic-panel__textarea"
        rows="3"
        maxlength="120"
        placeholder="Technical difficulties — please stand by"
        bind:value={message}
        oninput={onMessageInput}
        disabled={!isActive}
      ></textarea>
    </div>

    <!-- Resume & clear -->
    <div class="panic-panel__section">
      <label class="panic-panel__label" for="panic-resume">Resume on</label>
      <select id="panic-resume" class="panic-panel__select" bind:value={resumeApp}>
        {#each APPS as app}
          <option value={app.id}>{app.label}</option>
        {/each}
      </select>
      <button
        class="panic-panel__clear"
        onclick={clear}
        disabled={!isActive}
      >
        Clear panic
      </button>
    </div>

    <!-- Current active app -->
    {#if broadcast}
      <div class="panic-panel__status">
        <span class="panic-panel__status-label">Active app</span>
        <span class="panic-panel__status-value">{broadcast.activeApp}</span>
      </div>
    {/if}

  </div>
</div>

<style>
  .panic-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .panic-panel__badge {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--live);
    background: rgba(229, 57, 53, 0.12);
    padding: 1px 6px;
    border-radius: var(--radius);
    border: 1px solid var(--live);
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  .panic-panel__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
  }

  /* ─── Trigger button ────────────────────────────────────────── */

  .panic-panel__trigger {
    width: 100%;
    height: 72px;
    font-family: var(--font-mono, monospace);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #fff;
    background: var(--danger-dim);
    border: 2px solid var(--danger);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.1s, box-shadow 0.1s;
  }

  .panic-panel__trigger:not(:disabled):hover {
    background: var(--danger);
    box-shadow: 0 0 16px var(--live-glow);
  }

  .panic-panel__trigger--active {
    background: var(--danger);
    box-shadow: 0 0 24px var(--live-glow);
    cursor: default;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 16px var(--live-glow); }
    50%       { box-shadow: 0 0 32px rgba(229, 57, 53, 0.5); }
  }

  /* ─── Sections ──────────────────────────────────────────────── */

  .panic-panel__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .panic-panel__label {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .panic-panel__textarea {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font, sans-serif);
    font-size: var(--font-size-md);
    padding: 8px;
    resize: none;
    line-height: 1.4;
    transition: border-color 0.1s;
  }

  .panic-panel__textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .panic-panel__textarea:disabled {
    color: var(--text-dim);
    border-color: var(--border-dim);
  }

  .panic-panel__select {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-base);
    padding: 5px 8px;
    appearance: none;
  }

  .panic-panel__clear {
    padding: 7px 0;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-base);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
  }

  .panic-panel__clear:not(:disabled):hover {
    color: var(--ready);
    border-color: var(--ready);
  }

  .panic-panel__clear:disabled {
    color: var(--text-dim);
    border-color: var(--border-dim);
    cursor: default;
  }

  /* ─── Status bar ────────────────────────────────────────────── */

  .panic-panel__status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border-dim);
  }

  .panic-panel__status-label {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .panic-panel__status-value {
    font-size: var(--font-size-base);
    font-family: var(--font-mono, monospace);
    color: var(--text-muted);
  }
</style>
