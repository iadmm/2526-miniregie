<script lang="ts">
  import { onMount } from 'svelte';
  import { socketState } from '../lib/socket.svelte.ts';
  import { api, type ApiError } from '../lib/api.ts';
  import type { ScheduleEntry, JamConfig, AppId } from '@shared/types';

  // ─── Constants ──────────────────────────────────────────────────────────────

  const KNOWN_APPS: AppId[] = [
    'pre-jam-idle',
    'countdown-to-jam',
    'jam-mode',
    'end-of-countdown',
    'post-jam-idle',
    'micro-trottoir',
  ];

  const APP_COLOR: Record<string, string> = {
    'pre-jam-idle':      '#555555',
    'countdown-to-jam':  '#3b82f6',
    'jam-mode':          '#e87c2a',
    'end-of-countdown':  '#f59e0b',
    'post-jam-idle':     '#555555',
    'micro-trottoir':    '#22c55e',
  };

  const APP_SHORT: Record<string, string> = {
    'pre-jam-idle':      'PRE',
    'countdown-to-jam':  'CNTD',
    'jam-mode':          'JAM',
    'end-of-countdown':  'EOC',
    'post-jam-idle':     'POST',
    'micro-trottoir':    'MICRO',
  };

  const PX_PER_HOUR = 120;
  const TRACK_H     = 88;

  // ─── State ──────────────────────────────────────────────────────────────────

  let entries   = $state<ScheduleEntry[]>([]);
  let config    = $state<JamConfig | null>(null);
  let loading   = $state(false);
  let error     = $state<string | null>(null);
  let nowMs     = $state(Date.now());

  // form state
  let selected  = $state<ScheduleEntry | null>(null);
  let creating  = $state(false);
  let formAt    = $state('');
  let formApp   = $state<AppId>('jam-mode');
  let formLabel = $state('');
  let formError = $state<string | null>(null);
  let saving    = $state(false);

  let trackEl   = $state<HTMLElement | null>(null);

  // ─── Derived timeline refs ───────────────────────────────────────────────────

  const jam = $derived(socketState.globalState?.jam);

  // Use live startedAt/endsAt when running, otherwise best-effort from config
  const refStartMs = $derived(
    jam?.startedAt ?? (config ? new Date(config.jam.startAt).getTime() : null),
  );
  const refEndMs = $derived(
    jam?.endsAt ?? (config ? new Date(config.jam.endsAt).getTime() : null),
  );
  const durationMs = $derived(
    refStartMs !== null && refEndMs !== null && refEndMs > refStartMs
      ? refEndMs - refStartMs
      : null,
  );
  const trackWidth = $derived(
    durationMs !== null
      ? Math.max(800, Math.ceil(durationMs / 3_600_000) * PX_PER_HOUR)
      : 800,
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function parseHHMMSS(s: string): number {
    const [h = 0, m = 0, sec = 0] = s.split(':').map(Number);
    return (h * 3600 + m * 60 + sec) * 1000;
  }

  function resolveAt(at: string): number | null {
    if (at.startsWith('H+') && refStartMs !== null) return refStartMs + parseHHMMSS(at.slice(2));
    if (at.startsWith('T-') && refEndMs   !== null) return refEndMs   - parseHHMMSS(at.slice(2));
    const t = Date.parse(at);
    return Number.isNaN(t) ? null : t;
  }

  function timeToX(absMs: number): number {
    if (refStartMs === null || durationMs === null) return 0;
    return Math.round((absMs - refStartMs) / durationMs * trackWidth);
  }

  function xToMs(xPx: number): number {
    if (refStartMs === null || durationMs === null) return Date.now();
    return refStartMs + (xPx / trackWidth) * durationMs;
  }

  function formatMs(ms: number): string {
    return new Date(ms).toLocaleString('fr-BE', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit',  minute: '2-digit',
    });
  }

  const ticks = $derived.by(() => {
    if (refStartMs === null || refEndMs === null || durationMs === null) return [];
    const out: Array<{ x: number; label: string }> = [];
    const startH = Math.ceil(refStartMs / 3_600_000);
    const endH   = Math.floor(refEndMs  / 3_600_000);
    for (let h = startH; h <= endH; h++) {
      const ms = h * 3_600_000;
      out.push({
        x:     timeToX(ms),
        label: new Date(ms).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    return out;
  });

  const nowX = $derived(
    refStartMs !== null && durationMs !== null
      ? Math.max(0, Math.min(trackWidth, timeToX(nowMs)))
      : null,
  );

  const sortedEntries = $derived.by(() =>
    [...entries].sort((a, b) => {
      const ta = resolveAt(a.at) ?? Infinity;
      const tb = resolveAt(b.at) ?? Infinity;
      return ta - tb;
    }),
  );

  // ─── Load ────────────────────────────────────────────────────────────────────

  async function load(): Promise<void> {
    if (loading) return;
    loading = true;
    error   = null;
    try {
      const [e, c] = await Promise.all([api.schedule.list(), api.config.get()]);
      entries = e;
      config  = c;
    } catch (err) {
      error = (err as ApiError).error ?? 'Load failed';
    } finally {
      loading = false;
    }
  }

  $effect(() => { void load(); });

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  function openCreate(preAt = ''): void {
    formAt = preAt; formApp = 'jam-mode'; formLabel = ''; formError = null;
    selected = null; creating = true;
  }

  function openEdit(entry: ScheduleEntry): void {
    formAt = entry.at; formApp = entry.app as AppId; formLabel = entry.label ?? ''; formError = null;
    selected = entry; creating = false;
  }

  async function submitCreate(): Promise<void> {
    if (!formAt.trim()) { formError = 'at is required'; return; }
    saving = true; formError = null;
    try {
      await api.schedule.create({ at: formAt.trim(), app: formApp, label: formLabel.trim() || undefined });
      creating = false;
      await load();
    } catch (err) {
      formError = (err as ApiError).error ?? 'Create failed';
    } finally { saving = false; }
  }

  async function submitEdit(): Promise<void> {
    if (!selected || !formAt.trim()) { formError = 'at is required'; return; }
    saving = true; formError = null;
    try {
      await api.schedule.update(selected.id, { at: formAt.trim(), app: formApp, label: formLabel.trim() || null });
      selected = null;
      await load();
    } catch (err) {
      formError = (err as ApiError).error ?? 'Update failed';
    } finally { saving = false; }
  }

  async function submitDelete(): Promise<void> {
    if (!selected) return;
    saving = true; formError = null;
    try {
      await api.schedule.delete(selected.id);
      selected = null;
      await load();
    } catch (err) {
      formError = (err as ApiError).error ?? 'Delete failed';
    } finally { saving = false; }
  }

  function cancelForm(): void { selected = null; creating = false; formError = null; }

  // ─── Track click to pre-fill create form ────────────────────────────────────

  function onTrackClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('.chip')) return;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const xPx  = e.clientX - rect.left;
    openCreate(new Date(xToMs(xPx)).toISOString());
  }

  // ─── Now interval ────────────────────────────────────────────────────────────

  onMount(() => {
    const id = setInterval(() => { nowMs = Date.now(); }, 1000);
    return () => clearInterval(id);
  });
</script>

<div class="timeline" class:has-form={creating || selected !== null}>

  <!-- Header -->
  <div class="panel-header">
    <span class="panel-label">Timeline</span>
    <div class="hdr-right">
      {#if loading}
        <span class="loading-dot">●</span>
      {:else}
        <span class="entry-count">{entries.length} event{entries.length !== 1 ? 's' : ''}</span>
      {/if}
      <button class="btn btn-ghost btn-xs" onclick={() => void load()} title="Refresh">↺</button>
      <button class="btn btn-primary btn-xs" onclick={() => openCreate()}>+ Event</button>
    </div>
  </div>

  {#if error}
    <div class="error-bar">{error}</div>
  {/if}

  <!-- Track -->
  <div class="track-scroll">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="track-inner"
      style="width: {trackWidth}px; height: {TRACK_H}px"
      bind:this={trackEl}
      onclick={onTrackClick}
    >
      <!-- Hour ticks -->
      {#each ticks as tick (tick.x)}
        <div class="tick" style="left: {tick.x}px">
          <span class="tick-label">{tick.label}</span>
        </div>
      {/each}

      <!-- Event chips -->
      {#each sortedEntries as entry (entry.id)}
        {@const absMs = resolveAt(entry.at)}
        {@const x = absMs !== null ? Math.max(4, Math.min(trackWidth - 4, timeToX(absMs))) : null}
        {#if x !== null}
          <button
            class="chip"
            class:fired={entry.status === 'fired'}
            class:skipped={entry.status === 'skipped'}
            class:is-selected={selected?.id === entry.id}
            style="left: {x}px; --c: {APP_COLOR[entry.app] ?? '#888'};"
            onclick={(e) => { e.stopPropagation(); openEdit(entry); }}
            title="{entry.at} → {entry.app}"
          >
            <span class="chip-label">{entry.label ?? (APP_SHORT[entry.app] ?? entry.app)}</span>
            <span class="chip-stem"></span>
            <span class="chip-dot"></span>
          </button>
        {/if}
      {/each}

      <!-- Now needle -->
      {#if nowX !== null}
        <div class="now-needle" style="left: {nowX}px">
          <span class="now-label">NOW</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Entry list -->
  <div class="entry-list">
    {#if sortedEntries.length === 0 && !loading}
      <div class="empty">No scheduled events — click the track or "+ Event" to add one.</div>
    {:else}
      {#each sortedEntries as entry (entry.id)}
        {@const absMs = resolveAt(entry.at)}
        <div
          class="entry-row"
          class:is-selected={selected?.id === entry.id}
          class:fired={entry.status === 'fired'}
          style="--c: {APP_COLOR[entry.app] ?? '#888'};"
        >
          <span class="entry-dot"></span>
          <div class="entry-main">
            <span class="entry-at">{entry.at}</span>
            {#if absMs !== null}
              <span class="entry-resolved">{formatMs(absMs)}</span>
            {:else}
              <span class="entry-unresolved">unresolvable</span>
            {/if}
          </div>
          <span class="entry-app" style="color: {APP_COLOR[entry.app] ?? 'var(--text-dim)'}">
            {entry.label ?? entry.app}
          </span>
          <span class="badge {entry.status === 'pending' ? 'badge-pending' : entry.status === 'fired' ? 'badge-ready' : 'badge-evicted'}">
            {entry.status}
          </span>
          <button class="btn-row-edit" onclick={() => openEdit(entry)} title="Edit">✎</button>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Form drawer -->
  {#if creating || selected !== null}
    <div class="form-drawer">
      <div class="form-hdr">
        <span class="form-title">{creating ? 'New event' : 'Edit event'}</span>
        <button class="form-close" onclick={cancelForm}>✕</button>
      </div>
      <div class="form-fields">
        <div class="field-row">
          <label for="f-at" class="field-lbl">Time</label>
          <input
            id="f-at"
            class="field-in mono"
            bind:value={formAt}
            placeholder="H+00:10:00 · T-02:00:00 · ISO 8601"
          />
        </div>
        <div class="field-row">
          <label for="f-app" class="field-lbl">App</label>
          <select id="f-app" class="field-in" bind:value={formApp}>
            {#each KNOWN_APPS as appId}
              <option value={appId}>{appId}</option>
            {/each}
          </select>
        </div>
        <div class="field-row">
          <label for="f-label" class="field-lbl">Label</label>
          <input id="f-label" class="field-in" bind:value={formLabel} placeholder="Optional label" />
        </div>
      </div>
      {#if formError}
        <div class="form-error">{formError}</div>
      {/if}
      <div class="form-actions">
        {#if selected !== null}
          <button class="btn btn-danger btn-sm" onclick={submitDelete} disabled={saving}>
            {saving ? '…' : 'Delete'}
          </button>
        {/if}
        <button
          class="btn btn-primary btn-sm"
          onclick={creating ? submitCreate : submitEdit}
          disabled={saving}
        >
          {saving ? '…' : creating ? 'Create' : 'Save'}
        </button>
        <button class="btn btn-ghost btn-sm" onclick={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
    overflow: hidden;
    position: relative;
  }

  /* ── Header ────────────────────────────────────────────────────────────── */
  .hdr-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .loading-dot {
    font-size: 8px;
    color: var(--accent);
    animation: blink 1s step-end infinite;
  }

  @keyframes blink { 50% { opacity: 0.3; } }

  .entry-count {
    font-size: 10px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  /* ── Error bar ─────────────────────────────────────────────────────────── */
  .error-bar {
    padding: 5px 10px;
    font-size: 11px;
    color: #f87171;
    background: rgba(229,57,53,0.1);
    border-bottom: 1px solid rgba(229,57,53,0.3);
    flex-shrink: 0;
  }

  /* ── Track ─────────────────────────────────────────────────────────────── */
  .track-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    background: var(--bg);
    border-bottom: 1px solid var(--border-dim);
  }

  .track-inner {
    position: relative;
    cursor: crosshair;
    user-select: none;
  }

  /* axis baseline */
  .track-inner::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    bottom: 24px;
    height: 1px;
    background: var(--border);
    pointer-events: none;
  }

  /* ── Hour tick ─────────────────────────────────────────────────────────── */
  .tick {
    position: absolute;
    bottom: 5px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .tick::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 7px;
    background: var(--border-dim);
  }

  .tick-label {
    font-size: 9px;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    line-height: 1;
  }

  /* ── Event chip ────────────────────────────────────────────────────────── */
  .chip {
    position: absolute;
    bottom: 20px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    z-index: 2;
  }

  .chip-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--c);
    white-space: nowrap;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-bottom: 2px;
    line-height: 1.2;
  }

  .chip-stem {
    display: block;
    width: 1px;
    height: 14px;
    background: var(--c);
    opacity: 0.45;
  }

  .chip-dot {
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid var(--bg);
    transition: transform 0.1s;
    flex-shrink: 0;
  }

  .chip:hover .chip-dot,
  .chip.is-selected .chip-dot {
    transform: scale(1.5);
    border-color: #fff;
  }

  .chip.is-selected .chip-label { text-decoration: underline; }
  .chip.fired   { opacity: 0.4; }
  .chip.skipped { opacity: 0.3; }

  /* ── Now needle ────────────────────────────────────────────────────────── */
  .now-needle {
    position: absolute;
    top: 0;
    bottom: 24px;
    width: 2px;
    background: var(--live);
    z-index: 3;
    pointer-events: none;
  }

  .now-label {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--live);
    white-space: nowrap;
  }

  /* ── Entry list ────────────────────────────────────────────────────────── */
  .entry-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .timeline.has-form .entry-list {
    padding-bottom: 160px;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    font-size: 11px;
    color: var(--text-dim);
    padding: 0 20px;
    text-align: center;
  }

  .entry-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border-bottom: 1px solid var(--border-dim);
    transition: background 0.1s;
  }

  .entry-row:hover        { background: var(--bg-hover); }
  .entry-row.is-selected  { background: var(--bg-active); }
  .entry-row.fired        { opacity: 0.5; }

  .entry-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c);
    flex-shrink: 0;
  }

  .entry-main {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .entry-at {
    font-size: 11px;
    color: var(--text);
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .entry-resolved   { font-size: 10px; color: var(--text-dim); }
  .entry-unresolved { font-size: 10px; color: var(--warning); }

  .entry-app {
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }

  .btn-row-edit {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 13px;
    padding: 2px 5px;
    cursor: pointer;
    border-radius: var(--radius);
    flex-shrink: 0;
    line-height: 1;
  }

  .btn-row-edit:hover { color: var(--text); background: var(--bg-hover); }

  /* ── Form drawer ───────────────────────────────────────────────────────── */
  .form-drawer {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    z-index: 10;
  }

  .form-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-dim);
  }

  .form-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .form-close {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius);
    line-height: 1;
  }

  .form-close:hover { color: var(--text); }

  .form-fields {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-lbl {
    font-size: 10px;
    color: var(--text-muted);
    width: 38px;
    flex-shrink: 0;
  }

  .field-in {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    padding: 4px 7px;
  }

  .form-error {
    margin: 0 10px 4px;
    padding: 4px 8px;
    font-size: 11px;
    color: #f87171;
    background: rgba(229,57,53,0.1);
    border-radius: var(--radius);
  }

  .form-actions {
    display: flex;
    gap: 6px;
    padding: 6px 10px 8px;
    justify-content: flex-end;
  }

  .form-actions .btn-danger { margin-right: auto; }

  .mono { font-family: var(--font-mono); }
</style>
