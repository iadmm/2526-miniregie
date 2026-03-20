<script lang="ts">
  import { onMount } from 'svelte';
  import { socket, socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import type { ScheduleEntry } from '@shared/types';

  // ─── App catalogue ────────────────────────────────────────────────────────────

  const APPS = [
    { id: 'countdown-to-jam',  label: 'Countdown' },
    { id: 'jam-mode',          label: 'JAM mode' },
    { id: 'end-of-countdown',  label: 'End of countdown' },
    { id: 'post-jam-idle',     label: 'Post-JAM idle' },
    { id: 'micro-trottoir',    label: 'Micro-trottoir' },
    { id: 'pre-jam-idle',      label: 'Pre-JAM idle' },
  ];

  const APP_LABEL: Record<string, string> = Object.fromEntries(APPS.map(a => [a.id, a.label]));

  // ─── State ────────────────────────────────────────────────────────────────────

  let entries = $state<ScheduleEntry[]>([]);
  let loading = $state(false);
  let error   = $state<string | null>(null);

  // Form state (shared between create and edit)
  type AtMode = 'H+' | 'T-' | 'absolute';
  let formOpen    = $state(false);
  let editingId   = $state<number | null>(null);
  let atMode      = $state<AtMode>('H+');
  let atHHMMSS    = $state('00:10:00');
  let atAbsolute  = $state('');
  let formApp     = $state('jam-mode');
  let formLabel   = $state('');
  let saving      = $state(false);

  const nextTriggerAt = $derived(socketState.globalState?.broadcast.nextTriggerAt ?? null);

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function atDisplay(entry: ScheduleEntry): string {
    const at = entry.at;
    if (at.startsWith('H+')) return `JAM +${at.slice(2)}`;
    if (at.startsWith('T-')) return `END -${at.slice(2)}`;
    // absolute ISO
    try {
      return new Date(at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
    } catch { return at; }
  }

  function buildAt(): string {
    if (atMode === 'absolute') return new Date(atAbsolute).toISOString();
    return `${atMode}${atHHMMSS}`;
  }

  function parseEntryIntoForm(entry: ScheduleEntry) {
    const at = entry.at;
    if (at.startsWith('H+'))      { atMode = 'H+'; atHHMMSS = at.slice(2); }
    else if (at.startsWith('T-')) { atMode = 'T-'; atHHMMSS = at.slice(2); }
    else {
      atMode = 'absolute';
      // Convert ISO to datetime-local value
      const d = new Date(at);
      atAbsolute = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    }
    formApp   = entry.app;
    formLabel = entry.label ?? '';
  }

  function resetForm() {
    formOpen   = false;
    editingId  = null;
    atMode     = 'H+';
    atHHMMSS   = '00:10:00';
    atAbsolute = '';
    formApp    = 'jam-mode';
    formLabel  = '';
    error      = null;
  }

  // ─── Data ─────────────────────────────────────────────────────────────────────

  async function load() {
    loading = true;
    error = null;
    try {
      entries = await api.schedule.list();
    } catch {
      error = 'Failed to load schedule';
    } finally {
      loading = false;
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async function save() {
    saving = true;
    error = null;
    try {
      const at    = buildAt();
      const label = formLabel.trim() || undefined;
      if (editingId !== null) {
        await api.schedule.update(editingId, { at, app: formApp, label: label ?? null });
      } else {
        await api.schedule.create({ at, app: formApp, label });
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function resetStatus(id: number) {
    await api.schedule.update(id, { status: 'pending' });
    await load();
  }

  async function remove(id: number) {
    await api.schedule.delete(id);
    await load();
  }

  function openEdit(entry: ScheduleEntry) {
    editingId = entry.id;
    parseEntryIntoForm(entry);
    formOpen = true;
  }

  function openCreate() {
    editingId = null;
    resetForm();
    formOpen = true;
  }

  onMount(() => {
    load();
    socket.on('state', load);
    return () => { socket.off('state', load); };
  });
</script>

<div class="schedule-panel">

  <!-- ─── Header ─────────────────────────────────────────────────────────────── -->
  <div class="schedule-panel__header panel-header">
    <span class="panel-label">Schedule</span>
    <div class="schedule-panel__header-right">
      {#if nextTriggerAt}
        <span class="schedule-panel__next" title="Next trigger">
          ⏱ {new Date(nextTriggerAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      {/if}
      <button class="schedule-panel__add-btn" onclick={openCreate}>+ Add</button>
    </div>
  </div>

  <!-- ─── Error ──────────────────────────────────────────────────────────────── -->
  {#if error}
    <div class="schedule-panel__error">{error}</div>
  {/if}

  <!-- ─── Form ───────────────────────────────────────────────────────────────── -->
  {#if formOpen}
    <div class="schedule-form">
      <div class="schedule-form__title">{editingId !== null ? 'Edit entry' : 'New entry'}</div>

      <!-- Time -->
      <div class="schedule-form__row">
        <label class="schedule-form__label">Trigger</label>
        <div class="schedule-form__time-inputs">
          <select class="schedule-form__select" bind:value={atMode}>
            <option value="H+">H+ (after JAM start)</option>
            <option value="T-">T- (before JAM end)</option>
            <option value="absolute">Absolute time</option>
          </select>
          {#if atMode === 'absolute'}
            <input class="schedule-form__input" type="datetime-local" bind:value={atAbsolute} />
          {:else}
            <input class="schedule-form__input schedule-form__input--mono" type="text" placeholder="HH:MM:SS" bind:value={atHHMMSS} />
          {/if}
        </div>
      </div>

      <!-- App -->
      <div class="schedule-form__row">
        <label class="schedule-form__label">App</label>
        <select class="schedule-form__select" bind:value={formApp}>
          {#each APPS as app}
            <option value={app.id}>{app.label}</option>
          {/each}
        </select>
      </div>

      <!-- Label -->
      <div class="schedule-form__row">
        <label class="schedule-form__label">Label <span class="schedule-form__optional">(optional)</span></label>
        <input class="schedule-form__input" type="text" placeholder="e.g. Open mic starts" bind:value={formLabel} />
      </div>

      <!-- Actions -->
      <div class="schedule-form__actions">
        <button class="schedule-form__cancel" onclick={resetForm} disabled={saving}>Cancel</button>
        <button class="schedule-form__save" onclick={save} disabled={saving}>
          {saving ? 'Saving…' : editingId !== null ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  {/if}

  <!-- ─── List ───────────────────────────────────────────────────────────────── -->
  <div class="schedule-panel__list">
    {#if loading && entries.length === 0}
      <p class="schedule-panel__empty">Loading…</p>
    {:else if entries.length === 0}
      <p class="schedule-panel__empty">No scheduled events.</p>
    {:else}
      {#each entries as entry (entry.id)}
        <div class="schedule-entry" class:schedule-entry--fired={entry.status === 'fired'} class:schedule-entry--editing={editingId === entry.id}>
          <div class="schedule-entry__left">
            <span class="schedule-entry__at">{atDisplay(entry)}</span>
            <span class="schedule-entry__app">{APP_LABEL[entry.app] ?? entry.app}</span>
            {#if entry.label}
              <span class="schedule-entry__label">{entry.label}</span>
            {/if}
          </div>

          <div class="schedule-entry__right">
            <span class="schedule-entry__status schedule-entry__status--{entry.status}">{entry.status}</span>
            {#if entry.status === 'fired' || entry.status === 'skipped'}
              <button class="schedule-entry__action" title="Reset to pending" onclick={() => resetStatus(entry.id)}>↺</button>
            {/if}
            <button class="schedule-entry__action" title="Edit" onclick={() => openEdit(entry)}>✎</button>
            <button class="schedule-entry__action schedule-entry__action--danger" title="Delete" onclick={() => remove(entry.id)}>✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

</div>

<style>
  .schedule-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  /* ─── Header ──────────────────────────────────────────────── */

  .schedule-panel__header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .schedule-panel__next {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--warning);
  }

  .schedule-panel__add-btn {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
  }

  .schedule-panel__add-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .schedule-panel__error {
    padding: 5px 10px;
    font-size: 11px;
    color: var(--live);
    background: rgba(229, 57, 53, 0.08);
    flex-shrink: 0;
  }

  /* ─── Form ────────────────────────────────────────────────── */

  .schedule-form {
    padding: 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .schedule-form__title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .schedule-form__row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .schedule-form__label {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
  }

  .schedule-form__optional {
    text-transform: none;
    font-weight: normal;
    letter-spacing: 0;
    color: var(--text-dim);
  }

  .schedule-form__time-inputs {
    display: flex;
    gap: 6px;
  }

  .schedule-form__time-inputs .schedule-form__select {
    flex: 1.5;
  }

  .schedule-form__time-inputs .schedule-form__input {
    flex: 1;
  }

  .schedule-form__select,
  .schedule-form__input {
    background: var(--bg);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    font-family: var(--font, sans-serif);
    padding: 4px 7px;
    width: 100%;
  }

  .schedule-form__input--mono {
    font-family: var(--font-mono, monospace);
  }

  .schedule-form__select:focus,
  .schedule-form__input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .schedule-form__actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .schedule-form__cancel {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    padding: 4px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--border-dim);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .schedule-form__cancel:hover:not(:disabled) { color: var(--text-muted); }

  .schedule-form__save {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: rgba(232, 124, 42, 0.15);
    color: var(--accent);
    cursor: pointer;
    transition: background 0.1s;
  }

  .schedule-form__save:hover:not(:disabled) { background: rgba(232, 124, 42, 0.25); }
  .schedule-form__save:disabled { opacity: 0.5; cursor: default; }

  /* ─── List ────────────────────────────────────────────────── */

  .schedule-panel__list {
    flex: 1;
    overflow-y: auto;
  }

  .schedule-panel__empty {
    padding: 24px;
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
  }

  /* ─── Entry ───────────────────────────────────────────────── */

  .schedule-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border-dim);
    transition: background 0.1s;
  }

  .schedule-entry:last-child { border-bottom: none; }
  .schedule-entry--fired   { opacity: 0.5; }
  .schedule-entry--editing { background: rgba(232, 124, 42, 0.05); }

  .schedule-entry__left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .schedule-entry__at {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 700;
    color: var(--text);
  }

  .schedule-entry__app {
    font-size: 11px;
    color: var(--text-muted);
  }

  .schedule-entry__label {
    font-size: 10px;
    color: var(--text-dim);
    font-style: italic;
  }

  .schedule-entry__right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .schedule-entry__status {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: var(--radius);
  }

  .schedule-entry__status--pending  { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
  .schedule-entry__status--fired    { background: rgba(34, 197, 94, 0.15);  color: var(--ready);   }
  .schedule-entry__status--skipped  { background: rgba(110, 110, 110, 0.15); color: var(--text-dim); }

  .schedule-entry__action {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius);
    line-height: 1;
    transition: color 0.1s;
  }

  .schedule-entry__action:hover          { color: var(--text); }
  .schedule-entry__action--danger:hover  { color: var(--live); }
</style>
