<script lang="ts">
  import { scheduleState, refreshSchedule } from '../../lib/schedule.svelte.ts';
  import { api } from '../../lib/api.ts';
  import { APPS, APP_COLORS } from '../../lib/app-utils.ts';
  import type { ScheduleEntry } from '@shared/types';

  // ─── Add form ─────────────────────────────────────────────────────────────
  let newAt    = $state('');
  let newApp   = $state<string>(APPS[0]);
  let newLabel = $state('');
  let adding   = $state(false);
  let addError = $state<string | null>(null);

  async function addEntry() {
    if (!newAt.trim() || !newApp) return;
    adding = true;
    addError = null;
    try {
      await api.schedule.create({ at: newAt.trim(), app: newApp, label: newLabel.trim() || undefined });
      newAt    = '';
      newLabel = '';
      await refreshSchedule();
    } catch (e) {
      addError = (e as { error?: string })?.error ?? 'Erreur';
    } finally {
      adding = false;
    }
  }

  // ─── Edit in-place ────────────────────────────────────────────────────────
  let editingId = $state<number | null>(null);
  let editAt    = $state('');
  let editApp   = $state('');
  let editLabel = $state('');
  let saving    = $state(false);

  function startEdit(entry: ScheduleEntry) {
    editingId = entry.id;
    editAt    = entry.at;
    editApp   = entry.app;
    editLabel = entry.label ?? '';
  }

  function cancelEdit() {
    editingId = null;
  }

  async function saveEdit() {
    if (editingId === null) return;
    saving = true;
    try {
      const entry = scheduleState.entries.find(e => e.id === editingId);
      const patch: Record<string, unknown> = { label: editLabel.trim() || null };
      if (entry?.status === 'pending') {
        patch.at  = editAt.trim();
        patch.app = editApp;
      }
      await api.schedule.update(editingId, patch);
      editingId = null;
      await refreshSchedule();
    } catch {
      // keep editing open on error
    } finally {
      saving = false;
    }
  }

  // ─── Delete two-click ─────────────────────────────────────────────────────
  let pendingDeleteId  = $state<number | null>(null);
  let deleteTimer: ReturnType<typeof setTimeout> | null = null;

  function requestDelete(id: number) {
    if (pendingDeleteId === id) {
      doDelete(id);
    } else {
      pendingDeleteId = id;
      if (deleteTimer) clearTimeout(deleteTimer);
      deleteTimer = setTimeout(() => { pendingDeleteId = null; }, 3000);
    }
  }

  async function doDelete(id: number) {
    pendingDeleteId = null;
    if (deleteTimer) clearTimeout(deleteTimer);
    try {
      await api.schedule.delete(id);
      await refreshSchedule();
    } catch { /* ignore */ }
  }

  // ─── Reload ───────────────────────────────────────────────────────────────
  async function reload() {
    await api.schedule.reload();
    await refreshSchedule();
  }

  // Initial load
  $effect(() => {
    refreshSchedule();
  });
</script>

<div class="schedule-tab">
  <!-- Entry list -->
  <div class="entries-list">
    {#if scheduleState.loading && scheduleState.entries.length === 0}
      <div class="empty-state">Chargement…</div>
    {:else if scheduleState.entries.length === 0}
      <div class="empty-state">Aucune entrée — ajoutez des déclencheurs ci-dessous</div>
    {:else}
      {#each scheduleState.entries as entry (entry.id)}
        <div
          class="entry-row"
          class:fired={entry.status === 'fired'}
          class:skipped={entry.status === 'skipped'}
          class:editing={editingId === entry.id}
        >
          {#if editingId === entry.id}
            <div class="entry-edit">
              <input
                class="input mono"
                bind:value={editAt}
                placeholder="H+00:10:00"
                disabled={entry.status !== 'pending'}
              />
              <select class="select" bind:value={editApp} disabled={entry.status !== 'pending'}>
                {#each APPS as app}
                  <option value={app}>{app}</option>
                {/each}
              </select>
              <input class="input flex-1" bind:value={editLabel} placeholder="Label optionnel" />
              <div class="edit-actions">
                <button class="btn-save" onclick={saveEdit} disabled={saving}>
                  {saving ? '…' : 'OK'}
                </button>
                <button class="btn-cancel" onclick={cancelEdit}>✕</button>
              </div>
            </div>
          {:else}
            <div
              class="status-dot"
              style="background: {entry.status === 'fired'
                ? (APP_COLORS[entry.app] ?? '#888')
                : entry.status === 'skipped'
                  ? '#555'
                  : 'transparent'}; border: 1.5px solid {APP_COLORS[entry.app] ?? '#888'}"
            ></div>
            <span class="entry-at mono">{entry.at}</span>
            <span class="entry-app-pill" style="background: {APP_COLORS[entry.app] ?? '#444'}">
              {entry.app}
            </span>
            <span class="entry-label">{entry.label ?? ''}</span>
            <div class="entry-actions">
              <button class="btn-icon" onclick={() => startEdit(entry)} title="Éditer">✏</button>
              <button
                class="btn-icon"
                class:confirm={pendingDeleteId === entry.id}
                onclick={() => requestDelete(entry.id)}
                title={pendingDeleteId === entry.id ? 'Confirmer la suppression' : 'Supprimer'}
              >
                {pendingDeleteId === entry.id ? '!' : '×'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Add form -->
  <div class="add-form">
    {#if addError}
      <div class="form-error">{addError}</div>
    {/if}
    <div class="add-form-row">
      <input
        class="input mono"
        style="width: 110px; flex-shrink: 0"
        bind:value={newAt}
        placeholder="H+00:10:00"
      />
      <select class="select flex-1" bind:value={newApp}>
        {#each APPS as app}
          <option value={app}>{app}</option>
        {/each}
      </select>
    </div>
    <div class="add-form-row">
      <input class="input flex-1" bind:value={newLabel} placeholder="Label (optionnel)" />
      <button class="btn-add" onclick={addEntry} disabled={adding || !newAt.trim()}>
        {adding ? '…' : 'Ajouter'}
      </button>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <button class="btn-reload" onclick={reload}>⟳ Recharger depuis DB</button>
  </div>
</div>

<style>
  .schedule-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .entries-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .entry-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-bottom: 1px solid var(--border-dim);
    min-height: 30px;
  }

  .entry-row.fired   { opacity: 0.65; }
  .entry-row.skipped { opacity: 0.4; }
  .entry-row.editing { background: var(--bg-hover); }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .entry-at {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    flex-shrink: 0;
    min-width: 88px;
  }

  .entry-app-pill {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fff;
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-label {
    font-size: 10px;
    color: var(--text-dim);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .btn-icon {
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .btn-icon:hover  { background: var(--bg-hover); color: var(--text); }
  .btn-icon.confirm { color: var(--live); font-weight: 700; }

  /* Edit mode */
  .entry-edit {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
    align-items: center;
  }

  .edit-actions { display: flex; gap: 4px; }

  .empty-state {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }

  /* Add form */
  .add-form {
    border-top: 1px solid var(--border-dim);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-panel);
    flex-shrink: 0;
  }

  .add-form-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .form-error {
    font-size: 10px;
    color: var(--live);
    padding: 2px 0;
  }

  .flex-1 { flex: 1; min-width: 0; }

  .input {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 11px;
    padding: 4px 8px;
    min-width: 0;
  }

  .input:focus { outline: none; border-color: var(--accent); }
  .input.mono  { font-family: var(--font-mono); }

  .select {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 10px;
    padding: 4px 6px;
    cursor: pointer;
    min-width: 0;
  }

  .btn-add {
    padding: 4px 12px;
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: #000;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-save {
    padding: 2px 8px;
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-cancel {
    padding: 2px 6px;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
  }

  /* Footer */
  .footer {
    border-top: 1px solid var(--border-dim);
    padding: 6px 10px;
    display: flex;
    justify-content: flex-end;
    background: var(--bg-panel);
    flex-shrink: 0;
  }

  .btn-reload {
    font-size: 10px;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    padding: 3px 8px;
    cursor: pointer;
  }

  .btn-reload:hover { color: var(--text); border-color: var(--border); }
</style>
