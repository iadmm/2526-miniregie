<script lang="ts">
  import { socketState } from '../../lib/socket.svelte.ts';

  const connected  = $derived(socketState.connected);
  const jam        = $derived(socketState.globalState?.jam);
  const pool       = $derived(socketState.globalState?.pool);
  const broadcast  = $derived(socketState.globalState?.broadcast);
  const loading    = $derived(socketState.globalState === null);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function relTime(ts: number | null | undefined): string {
    if (ts == null) return '—';
    const diff = ts - Date.now();
    const abs  = Math.abs(diff);
    const sign = diff < 0 ? '-' : '+';
    const h    = Math.floor(abs / 3_600_000);
    const m    = Math.floor((abs % 3_600_000) / 60_000);
    const s    = Math.floor((abs % 60_000) / 1_000);
    if (h > 0)  return `${sign}${h}h${String(m).padStart(2, '0')}m`;
    if (m > 0)  return `${sign}${m}m${String(s).padStart(2, '0')}s`;
    return `${sign}${s}s`;
  }

  function typeBreakdown(byType: Record<string, number> | undefined): string {
    if (!byType) return '—';
    const entries = Object.entries(byType).filter(([, n]) => n > 0);
    if (entries.length === 0) return 'empty';
    return entries.map(([k, n]) => `${k}:${n}`).join('  ');
  }

  // ─── Derived diagnostics ──────────────────────────────────────────────────

  const jamStatus     = $derived(jam?.status ?? 'unknown');
  const activeApp     = $derived(broadcast?.activeApp ?? '—');
  const transition    = $derived(broadcast?.transition ?? 'idle');
  const panicOn       = $derived(broadcast?.panicState ?? false);
  const nextTrigger   = $derived(broadcast?.nextTriggerAt ?? null);
  const itemsReady    = $derived(pool?.total ?? 0);
  const holdCount     = $derived(pool?.holdCount ?? 0);

  // App should be jam-mode when JAM is running
  const appOk = $derived(
    jamStatus !== 'running' || activeApp === 'jam-mode',
  );
</script>

<div class="health-panel">
  <div class="health-panel__header panel-header">
    <span class="panel-label">Health</span>
    {#if loading}
      <span class="health-panel__loading">waiting…</span>
    {/if}
  </div>

  <div class="health-panel__body">

    <!-- ─── Connection ──────────────────────────────────────────────────────── -->
    <div class="health-section">
      <div class="health-section__title">Connection</div>

      <div class="health-row health-row--{connected ? 'ok' : 'warn'}">
        <span class="health-row__dot" aria-hidden="true"></span>
        <span class="health-row__label">Admin socket</span>
        <span class="health-row__val">{connected ? 'connected' : 'disconnected'}</span>
      </div>
    </div>

    <!-- ─── JAM ─────────────────────────────────────────────────────────────── -->
    <div class="health-section">
      <div class="health-section__title">JAM</div>

      <div class="health-row health-row--{jamStatus === 'running' ? 'ok' : jamStatus === 'idle' ? 'warn' : 'dim'}">
        <span class="health-row__dot" aria-hidden="true"></span>
        <span class="health-row__label">Status</span>
        <span class="health-row__val">{jamStatus}</span>
      </div>

      {#if jam?.startedAt != null}
        <div class="health-row health-row--dim">
          <span class="health-row__dot health-row__dot--empty" aria-hidden="true"></span>
          <span class="health-row__label">Started</span>
          <span class="health-row__val">{relTime(jam.startedAt)} ago</span>
        </div>
      {/if}

      {#if jam?.endsAt != null}
        {@const overtime = (jam.timeRemaining ?? 0) <= 0}
        <div class="health-row health-row--{overtime ? 'warn' : 'dim'}">
          <span class="health-row__dot health-row__dot--empty" aria-hidden="true"></span>
          <span class="health-row__label">Ends</span>
          <span class="health-row__val">{overtime ? 'OVERTIME' : relTime(jam.endsAt)}</span>
        </div>
      {/if}
    </div>

    <!-- ─── Broadcast ───────────────────────────────────────────────────────── -->
    <div class="health-section">
      <div class="health-section__title">Broadcast</div>

      <div class="health-row health-row--{appOk ? 'ok' : 'warn'}">
        <span class="health-row__dot" aria-hidden="true"></span>
        <span class="health-row__label">Active app</span>
        <span class="health-row__val">{activeApp}</span>
      </div>

      <div class="health-row health-row--{transition === 'idle' ? 'dim' : 'warn'}">
        <span class="health-row__dot health-row__dot--{transition === 'idle' ? 'empty' : 'full'}" aria-hidden="true"></span>
        <span class="health-row__label">Transition</span>
        <span class="health-row__val">{transition}</span>
      </div>

      <div class="health-row health-row--{panicOn ? 'warn' : 'dim'}">
        <span class="health-row__dot health-row__dot--{panicOn ? 'full' : 'empty'}" aria-hidden="true"></span>
        <span class="health-row__label">Panic</span>
        <span class="health-row__val">{panicOn ? 'ACTIVE' : 'off'}</span>
      </div>

      {#if nextTrigger != null}
        <div class="health-row health-row--dim">
          <span class="health-row__dot health-row__dot--empty" aria-hidden="true"></span>
          <span class="health-row__label">Next trigger</span>
          <span class="health-row__val">{relTime(nextTrigger)}</span>
        </div>
      {/if}
    </div>

    <!-- ─── Pool ────────────────────────────────────────────────────────────── -->
    <div class="health-section">
      <div class="health-section__title">Pool</div>

      <div class="health-row health-row--{itemsReady >= 3 ? 'ok' : itemsReady > 0 ? 'warn' : 'warn'}">
        <span class="health-row__dot" aria-hidden="true"></span>
        <span class="health-row__label">Items ready</span>
        <span class="health-row__val">{itemsReady}</span>
      </div>

      <div class="health-row health-row--{holdCount > 0 ? 'warn' : 'dim'}">
        <span class="health-row__dot health-row__dot--{holdCount > 0 ? 'full' : 'empty'}" aria-hidden="true"></span>
        <span class="health-row__label">Hold events</span>
        <span class="health-row__val">{holdCount}</span>
      </div>

      <div class="health-row health-row--dim">
        <span class="health-row__dot health-row__dot--empty" aria-hidden="true"></span>
        <span class="health-row__label">By type</span>
        <span class="health-row__val health-row__val--wrap">{typeBreakdown(pool?.byType)}</span>
      </div>
    </div>

  </div>
</div>

<style>
  .health-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
    overflow-y: auto;
  }

  .health-panel__loading {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-dim);
  }

  /* ─── Section ──────────────────────────────────────────────────────────────── */

  .health-section {
    border-bottom: 1px solid var(--border-dim);
    padding-bottom: 2px;
  }

  .health-section:last-child {
    border-bottom: none;
  }

  .health-section__title {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 10px 16px 4px;
  }

  /* ─── Row ──────────────────────────────────────────────────────────────────── */

  .health-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 16px;
  }

  .health-row__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Filled dot (status indicator) */
  .health-row--ok   .health-row__dot:not(.health-row__dot--empty) { background: var(--ready);   box-shadow: 0 0 6px var(--ready); }
  .health-row--warn .health-row__dot:not(.health-row__dot--empty) { background: var(--danger);  box-shadow: 0 0 6px var(--danger); }
  .health-row--dim  .health-row__dot:not(.health-row__dot--empty) { background: var(--text-dim); }

  /* Warn dot forced full */
  .health-row--warn .health-row__dot--full { background: var(--danger); box-shadow: 0 0 6px var(--danger); }

  /* Empty dot — just an indent spacer */
  .health-row__dot--empty { background: transparent; }

  .health-row__label {
    font-size: var(--font-size-md);
    font-weight: 400;
    flex: 1;
    min-width: 0;
  }

  .health-row--ok   .health-row__label { color: var(--text); }
  .health-row--warn .health-row__label { color: var(--danger); }
  .health-row--dim  .health-row__label { color: var(--text-muted); }

  .health-row__val {
    font-family: var(--font-mono);
    font-size: var(--font-size-base);
    color: var(--text-dim);
    flex-shrink: 0;
    text-align: right;
  }

  .health-row--warn .health-row__val { color: var(--danger); opacity: 0.8; }

  .health-row__val--wrap {
    white-space: normal;
    text-align: right;
    max-width: 140px;
    line-height: 1.5;
    font-size: var(--font-size-sm);
  }
</style>
