<script lang="ts">
  import { api } from '../../lib/api.ts';
  import type { JamConfig } from '@shared/types';

  // ─── State ──────────────────────────────────────────────────────────────────

  // Slider values in human units (seconds or minutes or integers)
  let itemCooldownSec    = $state(300);   // default 5 min = 300s
  let authorCooldownSec  = $state(180);   // default 3 min = 180s
  let freshWindowMin     = $state(15);    // default 15 min
  let clipQuota          = $state(3);

  type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';
  let saveStatus = $state<SaveStatus>('idle');
  let saveError  = $state<string | null>(null);

  let initialized = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Init ───────────────────────────────────────────────────────────────────

  $effect(() => {
    api.config.get().then(cfg => {
      applyConfig(cfg);
      setTimeout(() => { initialized = true; }, 0);
    }).catch(() => { initialized = true; });
  });

  function applyConfig(cfg: JamConfig): void {
    itemCooldownSec   = Math.round(cfg.pool.itemCooldownMs / 1_000);
    authorCooldownSec = Math.round(cfg.pool.authorDisplayCooldownMs / 1_000);
    freshWindowMin    = Math.round(cfg.pool.freshItemWindowMs / 60_000);
    clipQuota         = cfg.pool.clipQuotaPerParticipant;
  }

  // ─── Debounced autosave ─────────────────────────────────────────────────────

  $effect(() => {
    // Register reactive dependencies on all slider values
    void [itemCooldownSec, authorCooldownSec, freshWindowMin, clipQuota];
    if (!initialized) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    saveStatus = 'pending';
    debounceTimer = setTimeout(doSave, 500);
  });

  async function doSave(): Promise<void> {
    saveError = null;
    try {
      await api.config.update({
        pool: {
          itemCooldownMs:          itemCooldownSec * 1_000,
          authorDisplayCooldownMs: authorCooldownSec * 1_000,
          clipQuotaPerParticipant: clipQuota,
          freshItemWindowMs:       freshWindowMin * 60_000,
        },
      });
      saveStatus = 'saved';
      setTimeout(() => { saveStatus = 'idle'; }, 2000);
    } catch (err) {
      saveError  = (err as { error?: string }).error ?? 'Save failed';
      saveStatus = 'error';
    }
  }

  async function saveNow(): Promise<void> {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    await doSave();
  }

  async function reloadFromFile(): Promise<void> {
    saveError = null;
    try {
      const cfg = await api.config.get();
      applyConfig(cfg);
    } catch (err) {
      saveError = (err as { error?: string }).error ?? 'Reload failed';
    }
  }

  // ─── Display helpers ────────────────────────────────────────────────────────

  function fmtSec(s: number): string {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m}:00` : `${m}:${String(r).padStart(2, '0')}`;
  }

  function fmtMin(m: number): string {
    return `${m}:00`;
  }
</script>

<div class="scoring-body">

  <!-- ─── Cooldowns ──────────────────────────────────────────────────────────── -->
  <section class="scoring-section">
    <div class="section-title">Cooldowns</div>

    <div class="slider-row">
      <label class="slider-label" for="item-cooldown">Item cooldown</label>
      <div class="slider-control">
        <input
          id="item-cooldown"
          type="range"
          min={60}
          max={1800}
          step={30}
          bind:value={itemCooldownSec}
        />
        <span class="slider-value">{fmtSec(itemCooldownSec)}</span>
      </div>
      <span class="slider-desc">before same item can appear again</span>
    </div>

    <div class="slider-row">
      <label class="slider-label" for="author-cooldown">Author cooldown</label>
      <div class="slider-control">
        <input
          id="author-cooldown"
          type="range"
          min={30}
          max={600}
          step={30}
          bind:value={authorCooldownSec}
        />
        <span class="slider-value">{fmtSec(authorCooldownSec)}</span>
      </div>
      <span class="slider-desc">before same author can appear again</span>
    </div>
  </section>

  <!-- ─── Priorities ────────────────────────────────────────────────────────── -->
  <section class="scoring-section">
    <div class="section-title">Priorities <span class="section-note">(not configurable yet)</span></div>

    {#each [
      { label: 'Photos / GIFs', value: 100 },
      { label: 'Clips',         value: 100 },
      { label: 'Links',         value: 100 },
      { label: 'Notes',         value: 100 },
      { label: 'Interviews',    value: 200 },
      { label: 'Tickers',       value: 80  },
    ] as entry (entry.label)}
      <div class="slider-row disabled" title="typePriorities not yet in JamConfig — coming in a future version">
        <span class="slider-label">{entry.label}</span>
        <div class="slider-control">
          <input
            type="range"
            min={50}
            max={300}
            step={10}
            value={entry.value}
            disabled
          />
          <span class="slider-value">{entry.value}</span>
        </div>
      </div>
    {/each}
  </section>

  <!-- ─── Pool ──────────────────────────────────────────────────────────────── -->
  <section class="scoring-section">
    <div class="section-title">Pool</div>

    <div class="slider-row">
      <label class="slider-label" for="fresh-window">Freshness window</label>
      <div class="slider-control">
        <input
          id="fresh-window"
          type="range"
          min={5}
          max={60}
          step={5}
          bind:value={freshWindowMin}
        />
        <span class="slider-value">{fmtMin(freshWindowMin)}</span>
      </div>
      <span class="slider-desc">items submitted within this window get +80 score</span>
    </div>

    <div class="slider-row">
      <label class="slider-label" for="clip-quota">Clip quota / participant</label>
      <div class="slider-control">
        <input
          id="clip-quota"
          type="range"
          min={1}
          max={10}
          step={1}
          bind:value={clipQuota}
        />
        <span class="slider-value">{clipQuota}</span>
      </div>
      <span class="slider-desc">max clips accepted per participant per JAM</span>
    </div>
  </section>

  <!-- ─── Footer ────────────────────────────────────────────────────────────── -->
  <section class="scoring-footer">
    <div class="volatile-notice">
      Changes are volatile — lost on server restart unless saved.
    </div>

    {#if saveError}
      <div class="error-bar">{saveError}</div>
    {/if}

    <div class="footer-actions">
      <button
        class="btn btn-primary"
        class:btn-saved={saveStatus === 'saved'}
        onclick={saveNow}
        disabled={saveStatus === 'pending'}
      >
        {#if saveStatus === 'saved'}
          Saved
        {:else if saveStatus === 'pending'}
          Saving...
        {:else}
          Save to config/jam.json
        {/if}
      </button>

      <button class="btn btn-ghost" onclick={reloadFromFile}>
        Reload from file
      </button>
    </div>
  </section>

</div>

<style>
  .scoring-body {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .scoring-section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-dim);
  }

  .section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    margin-bottom: 10px;
  }

  .section-note {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-dim);
    opacity: 0.6;
  }

  /* ─── Slider row ───────────────────────────────────────────────────────────── */

  .slider-row {
    display: grid;
    grid-template-columns: 110px 1fr;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 8px;
    margin-bottom: 10px;
  }

  .slider-row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .slider-label {
    font-size: 11px;
    color: var(--text-muted);
    grid-row: 1;
    grid-column: 1;
    white-space: nowrap;
  }

  .slider-control {
    display: flex;
    align-items: center;
    gap: 8px;
    grid-row: 1;
    grid-column: 2;
  }

  .slider-control input[type="range"] {
    flex: 1;
    accent-color: var(--accent);
    cursor: pointer;
    height: 4px;
  }

  .slider-control input[type="range"]:disabled {
    cursor: not-allowed;
  }

  .slider-value {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    min-width: 36px;
    text-align: right;
  }

  .slider-desc {
    grid-row: 2;
    grid-column: 2;
    font-size: 9px;
    color: var(--text-dim);
    margin-top: 2px;
  }

  /* ─── Footer ────────────────────────────────────────────────────────────────── */

  .scoring-footer {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .volatile-notice {
    font-size: 10px;
    color: var(--warning, #f59e0b);
    line-height: 1.4;
  }

  .footer-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-saved {
    background: var(--success, #22c55e);
    border-color: var(--success, #22c55e);
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--border-dim);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .error-bar {
    font-size: 10px;
    color: var(--danger, #f44336);
  }
</style>
