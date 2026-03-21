<script lang="ts">
  import { socketState } from '../../lib/socket.svelte.ts';
  import { api } from '../../lib/api.ts';
  import type { JamConfig } from '@shared/types';
  import FieldGroup from '../ui/FieldGroup.svelte';

  type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

  const SAVE_LABELS: Record<SaveStatus, string> = {
    idle:    '',
    pending: 'saving…',
    saved:   'saved',
    error:   'error',
  };

  const jam = $derived(socketState.globalState?.jam);

  let saveStatus  = $state<SaveStatus>('idle');
  let saveError   = $state<string | null>(null);
  // plain (non-reactive) flags — changes must NOT re-trigger effects
  let initialized                                         = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let form = $state({
    startAt:               '',
    endsAt:                '',
    transitionFailsafeSec: 3,
    statePersistSec:       30,
    postJamIdleMin:        5,
    clipQuota:             3,
    watchdogSec:           30,
  });

  function isoToDatetimeLocal(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function datetimeLocalToIso(local: string): string {
    if (!local) return '';
    return new Date(local).toISOString();
  }

  function configToForm(cfg: JamConfig): void {
    form.startAt               = isoToDatetimeLocal(cfg.jam.startAt);
    form.endsAt                = isoToDatetimeLocal(cfg.jam.endsAt);
    form.transitionFailsafeSec = cfg.broadcast.transitionFailsafeMs / 1_000;
    form.statePersistSec       = cfg.broadcast.statePersistIntervalMs / 1_000;
    form.postJamIdleMin        = cfg.broadcast.postJamIdleDelayMs / 60_000;
    form.clipQuota             = cfg.pool.clipQuotaPerParticipant;
    form.watchdogSec           = cfg.client.watchdogTimeoutMs / 1_000;
  }

  function formToConfig(): Partial<JamConfig> {
    return {
      jam: {
        startAt: datetimeLocalToIso(form.startAt),
        endsAt:  datetimeLocalToIso(form.endsAt),
      },
      broadcast: {
        transitionFailsafeMs:   form.transitionFailsafeSec * 1_000,
        statePersistIntervalMs: form.statePersistSec * 1_000,
        postJamIdleDelayMs:     form.postJamIdleMin * 60_000,
      },
      pool: {
        clipQuotaPerParticipant: form.clipQuota,
      },
      client: {
        watchdogTimeoutMs: form.watchdogSec * 1_000,
      },
    };
  }

  $effect(() => {
    api.config.get().then(cfg => {
      configToForm(cfg);
      // defer so the autosave effect below doesn't fire for the initial population
      setTimeout(() => { initialized = true; }, 0);
    }).catch(() => { initialized = true; });
  });

  // autosave: debounce 800ms after any form change
  $effect(() => {
    // read every field to register reactive dependencies
    void JSON.stringify(form);
    if (!initialized) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    saveStatus = 'pending';
    debounceTimer = setTimeout(autoSave, 800);
  });

  async function autoSave(): Promise<void> {
    saveError = null;
    try {
      await api.config.update(formToConfig());
      saveStatus = 'saved';
      setTimeout(() => { saveStatus = 'idle'; }, 2000);
    } catch (err) {
      saveError  = (err as { error?: string }).error ?? 'Erreur';
      saveStatus = 'error';
    }
  }
</script>

<div class="settings-header">
  <span class="settings-header__title">Settings</span>
  {#if saveStatus !== 'idle'}
    <span class="settings-header__status settings-header__status--{saveStatus}">
      {SAVE_LABELS[saveStatus]}
    </span>
  {/if}
</div>

<div class="settings-body">

  <section class="settings-section">
    <div class="section-title">Calendrier</div>
    <FieldGroup id="cfg-start-at" label="Début" desc="Heure de démarrage du JAM (déclenche le countdown)">
      <input id="cfg-start-at" type="datetime-local" bind:value={form.startAt} />
    </FieldGroup>
    <FieldGroup id="cfg-ends-at" label="Fin" desc="Heure de fin absolue du JAM (trigger automatique)">
      <input id="cfg-ends-at" type="datetime-local" bind:value={form.endsAt} />
    </FieldGroup>
  </section>

  <section class="settings-section">
    <div class="section-title">Broadcast</div>
    <FieldGroup id="cfg-failsafe" label="Failsafe transition" desc="Délai max avant forçage de transition si l'app ne répond pas" unit="s">
      <input id="cfg-failsafe" type="number" min="1" bind:value={form.transitionFailsafeSec} />
    </FieldGroup>
    <FieldGroup id="cfg-persist" label="Persist état" desc="Intervalle de sauvegarde de state.json sur disque" unit="s">
      <input id="cfg-persist" type="number" min="5" bind:value={form.statePersistSec} />
    </FieldGroup>
    <FieldGroup id="cfg-post-idle" label="Post-jam idle" desc="Temps d'attente en idle avant de passer en post-JAM" unit="min">
      <input id="cfg-post-idle" type="number" min="1" bind:value={form.postJamIdleMin} />
    </FieldGroup>
  </section>

  <section class="settings-section">
    <div class="section-title">Pool</div>
    <FieldGroup id="cfg-clip-quota" label="Quota clips" desc="Nombre maximum de clips vidéo acceptés par participant" unit="clips">
      <input id="cfg-clip-quota" type="number" min="1" max="20" bind:value={form.clipQuota} />
    </FieldGroup>
    <div class="field-row">
      <span class="field-label">Total items</span>
      <span class="mono">{socketState.globalState?.pool.total ?? '—'}</span>
    </div>
  </section>

  <section class="settings-section">
    <div class="section-title">Client broadcast</div>
    <FieldGroup id="cfg-watchdog" label="Watchdog timeout" desc="Reload automatique du client si aucun ping reçu dans ce délai" unit="s">
      <input id="cfg-watchdog" type="number" min="5" bind:value={form.watchdogSec} />
    </FieldGroup>
  </section>

  {#if saveError}
    <div class="error-bar">{saveError}</div>
  {/if}

</div>

<style>
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    height: 36px;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .settings-header__title {
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .settings-header__status {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .settings-header__status--pending { color: var(--text-dim); }
  .settings-header__status--saved   { color: var(--ready); }
  .settings-header__status--error   { color: var(--danger); }

  .settings-body {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .settings-section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-dim);
  }

  .section-title {
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .field-label {
    font-size: var(--font-size-md);
    color: var(--text);
    white-space: nowrap;
  }

  .error-bar {
    padding: 6px 12px;
    font-size: var(--font-size-sm);
    color: var(--danger, #f44336);
  }
</style>