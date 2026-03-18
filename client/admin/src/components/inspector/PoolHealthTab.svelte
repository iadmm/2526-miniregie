<script lang="ts">
  import { socketState } from '../../lib/socket.svelte.ts';

  // ─── Derived state from GlobalState ───────────────────────────────────────

  const pool      = $derived(socketState.globalState?.pool);
  const broadcast = $derived(socketState.globalState?.broadcast);
  const regime    = $derived(broadcast?.regime ?? 'normal');

  // All media types — fixed order for the type breakdown table
  const TYPE_ORDER = ['photo', 'gif', 'clip', 'youtube', 'note', 'link', 'interview', 'ticker'] as const;

  // Type icons (text-only, no emoji dependency)
  const TYPE_ICONS: Record<string, string> = {
    photo:     'PHOTO',
    gif:       'GIF',
    clip:      'CLIP',
    youtube:   'YT',
    note:      'NOTE',
    link:      'LINK',
    interview: 'INTV',
    ticker:    'TICK',
  };

  // Derived: sorted type entries with count + percentage bar width
  const typeEntries = $derived(() => {
    if (!pool) return [];
    const total = pool.total > 0 ? pool.total : 1; // avoid /0
    return TYPE_ORDER
      .filter(t => (pool.byType[t] ?? 0) > 0)
      .map(t => ({
        type:    t,
        count:   pool.byType[t] ?? 0,
        pct:     Math.round(((pool.byType[t] ?? 0) / total) * 100),
        barPct:  Math.max(2, Math.round(((pool.byType[t] ?? 0) / total) * 100)),
      }))
      .sort((a, b) => b.count - a.count);
  });

  // Score bar widths — map scoreMax/scoreMin to 0-100% bar
  // scoreMax gets 100% bar, scoreMin gets proportional bar
  const scoreBarMax = $derived(100);
  const scoreBarMin = $derived(() => {
    if (!pool || pool.scoreMax === null || pool.scoreMin === null) return 0;
    if (pool.scoreMax === 0) return 0;
    return Math.max(2, Math.round((pool.scoreMin / pool.scoreMax) * 100));
  });

  // Regime label + colour class
  function regimeClass(r: string): string {
    if (r === 'hold')   return 'regime-hold';
    if (r === 'buffer') return 'regime-buffer';
    return 'regime-normal';
  }

  function regimeLabel(r: string): string {
    if (r === 'hold')   return 'HOLD';
    if (r === 'buffer') return 'BUFFER';
    return 'NORMAL';
  }
</script>

<div class="pool-health-tab">
  <div class="section-title">Pool Health</div>

  <!-- ── Summary grid ── -->
  {#if pool}
    <div class="stats-grid">
      <div class="stat-cell">
        <span class="stat-label">Total ready</span>
        <span class="stat-value">{pool.total}</span>
      </div>
      <div class="stat-cell">
        <span class="stat-label">Fresh (&lt; 15 min)</span>
        <span class="stat-value fresh">{pool.fresh}</span>
      </div>
      <div class="stat-cell">
        <span class="stat-label">Pinned</span>
        <span class="stat-value">{pool.pinned}</span>
      </div>
      <div class="stat-cell">
        <span class="stat-label">Hold count</span>
        <span class="stat-value" class:warn={pool.holdCount > 2}>{pool.holdCount}</span>
      </div>
    </div>

    <!-- ── Regime indicator ── -->
    <div class="regime-row">
      <span class="regime-lbl">Regime</span>
      <span class="regime-pill {regimeClass(regime)}">
        <span class="regime-dot"></span>
        {regimeLabel(regime)}
      </span>
    </div>

    <!-- ── Score range ── -->
    {#if pool.scoreMax !== null || pool.scoreMin !== null}
      <div class="section-subtitle">Score range</div>
      <div class="score-bars">
        <div class="score-row">
          <span class="score-label">Max</span>
          <div class="bar-track">
            <div class="bar-fill bar-max" style="width: {scoreBarMax}%"></div>
          </div>
          <span class="score-num">{pool.scoreMax ?? '—'}</span>
        </div>
        <div class="score-row">
          <span class="score-label">Min</span>
          <div class="bar-track">
            <div class="bar-fill bar-min" style="width: {scoreBarMin()}%"></div>
          </div>
          <span class="score-num score-low">{pool.scoreMin ?? '—'}</span>
        </div>
      </div>
    {/if}

    <!-- ── Type breakdown ── -->
    {#if typeEntries().length > 0}
      <div class="section-subtitle">By type</div>
      <div class="type-table">
        {#each typeEntries() as entry (entry.type)}
          <div class="type-row">
            <span class="type-badge type-{entry.type}">{TYPE_ICONS[entry.type] ?? entry.type}</span>
            <div class="bar-track type-bar-track">
              <div class="bar-fill type-bar-fill" style="width: {entry.barPct}%"></div>
            </div>
            <span class="type-count">{entry.count}</span>
            <span class="type-pct">{entry.pct}%</span>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="empty">En attente de données…</div>
  {/if}
</div>

<style>
  .pool-health-tab {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 10px 0 0;
  }

  /* ── Section headers ─────────────────────────────────────────────────────── */

  .section-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 0 12px 6px;
    border-bottom: 1px solid var(--border-dim);
  }

  .section-subtitle {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 8px 12px 4px;
  }

  /* ── Summary grid ────────────────────────────────────────────────────────── */

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--border-dim);
    border-bottom: 1px solid var(--border-dim);
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    background: var(--bg-panel);
  }

  .stat-label {
    font-size: 9px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .stat-value {
    font-size: 18px;
    font-family: var(--font-mono), monospace;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  .stat-value.fresh { color: #22c55e; }
  .stat-value.warn  { color: #f59e0b; }

  /* ── Regime ──────────────────────────────────────────────────────────────── */

  .regime-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-dim);
  }

  .regime-lbl {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .regime-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid transparent;
  }

  .regime-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .regime-normal {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .regime-hold {
    color: var(--live, #ef4444);
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    animation: hold-pulse 1.2s ease-in-out infinite;
  }

  .regime-buffer {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
  }

  @keyframes hold-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.55; }
  }

  /* ── Score bars ──────────────────────────────────────────────────────────── */

  .score-bars {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 12px 8px;
  }

  .score-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .score-label {
    font-size: 9px;
    color: var(--text-dim);
    width: 22px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg-surface, #1a1a1a);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  .bar-max { background: #22c55e; }
  .bar-min { background: #ef4444; }

  .score-num {
    font-size: 10px;
    font-family: var(--font-mono), monospace;
    font-weight: 700;
    color: var(--text);
    width: 36px;
    text-align: right;
    flex-shrink: 0;
  }

  .score-low { color: #ef4444; }

  /* ── Type table ──────────────────────────────────────────────────────────── */

  .type-table {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 0 12px 10px;
  }

  .type-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .type-badge {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid transparent;
    text-transform: uppercase;
    width: 34px;
    text-align: center;
    flex-shrink: 0;
  }

  /* Colour accents — mirror OnAirPanel */
  .type-photo    { background: rgba(66, 153, 225, 0.15);  color: #63b3ed; border-color: rgba(66, 153, 225, 0.3);  }
  .type-gif      { background: rgba(159, 122, 234, 0.15); color: #b794f4; border-color: rgba(159, 122, 234, 0.3); }
  .type-note     { background: rgba(72, 187, 120, 0.15);  color: #68d391; border-color: rgba(72, 187, 120, 0.3);  }
  .type-clip     { background: rgba(237, 137, 54, 0.15);  color: #f6ad55; border-color: rgba(237, 137, 54, 0.3);  }
  .type-link     { background: rgba(99, 179, 237, 0.12);  color: #90cdf4; border-color: rgba(99, 179, 237, 0.3);  }
  .type-youtube  { background: rgba(245, 101, 101, 0.15); color: #fc8181; border-color: rgba(245, 101, 101, 0.3); }
  .type-interview{ background: rgba(246, 173, 85, 0.15);  color: #f6ad55; border-color: rgba(246, 173, 85, 0.3);  }
  .type-ticker   { background: rgba(129, 230, 217, 0.15); color: #81e6d9; border-color: rgba(129, 230, 217, 0.3); }

  .type-bar-track { height: 5px; }

  .type-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--accent, #646cff);
    transition: width 0.4s ease;
  }

  .type-count {
    font-size: 10px;
    font-family: var(--font-mono), monospace;
    font-weight: 700;
    color: var(--text);
    width: 22px;
    text-align: right;
    flex-shrink: 0;
  }

  .type-pct {
    font-size: 9px;
    color: var(--text-dim);
    width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── Empty ───────────────────────────────────────────────────────────────── */

  .empty {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }
</style>
