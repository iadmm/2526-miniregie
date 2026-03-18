<script lang="ts">
  import { api } from '../lib/api.ts';
  import { socketState } from '../lib/socket.svelte.ts';
  import type { AppId } from '@shared/types';

  // Known app IDs for the resume selector
  const KNOWN_APPS: AppId[] = [
    'pre-jam-idle',
    'countdown-to-jam',
    'jam-mode',
    'micro-trottoir',
    'end-of-countdown',
    'post-jam-idle',
  ];

  let endsAtInput = $state('');
  let resumeAppId = $state<AppId>('jam-mode');
  let loading = $state<string | null>(null); // which action is pending
  let error = $state<string | null>(null);

  const jamStatus = $derived(socketState.globalState?.jam.status ?? 'idle');
  const panicState = $derived(socketState.globalState?.broadcast.panicState ?? false);
  const isRunning = $derived(jamStatus === 'running');
  const isIdle = $derived(jamStatus === 'idle');
  const isEnded = $derived(jamStatus === 'ended');

  async function doAction(key: string, fn: () => Promise<unknown>): Promise<void> {
    loading = key;
    error = null;
    try {
      await fn();
    } catch (err) {
      const apiErr = err as { error?: string };
      error = apiErr.error ?? 'Erreur inconnue.';
    } finally {
      loading = null;
    }
  }

  function handleStart(): void {
    if (!endsAtInput) {
      error = 'Sélectionne une date/heure de fin.';
      return;
    }
    const endsAt = new Date(endsAtInput).getTime();
    if (Number.isNaN(endsAt) || endsAt <= Date.now()) {
      error = 'La date de fin doit être dans le futur.';
      return;
    }
    doAction('start', () => api.jam.start(endsAt));
  }

  function handleEnd(): void {
    if (!confirm('Terminer la JAM maintenant ? Cette action est irréversible.')) return;
    doAction('end', () => api.jam.end());
  }

  function handlePanic(): void {
    doAction('panic', () => api.jam.panic());
  }

  function handleResume(): void {
    if (!resumeAppId.trim()) {
      error = 'Sélectionne une app pour reprendre.';
      return;
    }
    doAction('resume', () => api.jam.clearPanic(resumeAppId));
  }

  // Default endsAtInput to 48h from now when component mounts
  $effect(() => {
    if (!endsAtInput) {
      const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
      // Format for datetime-local input: "YYYY-MM-DDTHH:MM"
      endsAtInput = d.toISOString().slice(0, 16);
    }
  });
</script>

<div class="jam-controls">
  {#if error}
    <div class="error-msg" style="margin-bottom: 8px;">{error}</div>
  {/if}

  <!-- JAM start -->
  {#if !isRunning && !isEnded}
    <div class="control-row">
      <input
        type="datetime-local"
        bind:value={endsAtInput}
        class="ends-input"
        title="Heure de fin de la JAM"
      />
      <button
        class="btn btn-primary"
        onclick={handleStart}
        disabled={loading !== null}
      >
        {loading === 'start' ? '…' : 'Démarrer la JAM'}
      </button>
    </div>
  {/if}

  <!-- JAM end -->
  {#if isRunning && !panicState}
    <button
      class="btn btn-ghost"
      onclick={handleEnd}
      disabled={loading !== null}
    >
      {loading === 'end' ? '…' : 'Terminer la JAM'}
    </button>
  {/if}

  <!-- PANIC -->
  {#if !panicState}
    <button
      class="btn btn-panic"
      onclick={handlePanic}
      disabled={loading !== null || (!isRunning && !isIdle)}
      title="Active le mode panique — écran de sécurité immédiat"
    >
      {loading === 'panic' ? '…' : '⚠ PANIC'}
    </button>
  {/if}

  <!-- Resume after panic -->
  {#if panicState}
    <div class="resume-row">
      <span class="badge badge-panic">PANIC ACTIF</span>
      <select bind:value={resumeAppId} class="resume-select">
        {#each KNOWN_APPS as appId (appId)}
          <option value={appId}>{appId}</option>
        {/each}
      </select>
      <button
        class="btn btn-primary"
        onclick={handleResume}
        disabled={loading !== null}
      >
        {loading === 'resume' ? '…' : 'Reprendre'}
      </button>
    </div>
  {/if}
</div>

<style>
  .jam-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ends-input {
    font-size: 12px;
    padding: 5px 8px;
  }

  .resume-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .resume-select {
    font-size: 12px;
    padding: 5px 8px;
  }

  .btn-panic {
    background: var(--danger);
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 8px 24px;
    border-radius: var(--radius);
    border: 3px solid #ff6b6b;
    text-transform: uppercase;
    box-shadow: 0 0 12px rgba(229, 57, 53, 0.5);
    transition: background 0.1s, box-shadow 0.1s, transform 0.1s;
  }

  .btn-panic:hover:not(:disabled) {
    background: var(--danger-dim);
    box-shadow: 0 0 20px rgba(229, 57, 53, 0.8);
    transform: scale(1.03);
  }

  .btn-panic:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-panic:disabled {
    opacity: 0.35;
    box-shadow: none;
  }
</style>