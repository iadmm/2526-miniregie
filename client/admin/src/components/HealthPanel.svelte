<script lang="ts">
  // HealthPanel — "Coup d'œil" at 3am.
  // 5 binary indicators, readable at a glance on a phone.
  import { socketState } from '../lib/socket.svelte.ts';

  const connected = $derived(socketState.connected);
  const jam       = $derived(socketState.globalState?.jam);
  const pool      = $derived(socketState.globalState?.pool);
  const broadcast = $derived(socketState.globalState?.broadcast);

  // Last submission: newest submittedAt across the snapshot
  const lastSubmittedAt = $derived<number | null>(
    (() => {
      const items = socketState.globalState?.pool.queueSnapshot;
      if (!items || items.length === 0) return null;
      return Math.max(...items.map(i => i.submittedAt));
    })(),
  );

  const submissionFresh = $derived<boolean | null>(
    lastSubmittedAt === null ? null : Date.now() - lastSubmittedAt < 30 * 60_000,
  );

  type Status = 'ok' | 'warn' | 'unknown';

  interface Indicator {
    label: string;
    status: Status;
    note?: string;
  }

  const indicators = $derived<Indicator[]>([
    {
      label: 'Server connected',
      status: connected ? 'ok' : 'warn',
    },
    {
      label: 'JAM running',
      status: jam == null ? 'unknown' : jam.status === 'running' ? 'ok' : 'warn',
      note: jam?.status,
    },
    {
      label: 'Queue ≥ 3 items',
      status: pool == null ? 'unknown' : pool.total >= 3 ? 'ok' : 'warn',
      note: pool ? `${pool.total}` : undefined,
    },
    {
      label: 'Recent submission',
      status: submissionFresh === null ? 'unknown' : submissionFresh ? 'ok' : 'warn',
      note: submissionFresh === false ? '>30 min' : undefined,
    },
    {
      label: 'Not on hold',
      status: broadcast == null ? 'unknown' : broadcast.regime !== 'hold' ? 'ok' : 'warn',
      note: broadcast?.regime !== 'normal' ? broadcast?.regime : undefined,
    },
  ]);
</script>

<div class="health-panel">
  <div class="health-panel__header panel-header">
    <span class="panel-label">Health</span>
  </div>

  <div class="health-panel__body">
    {#each indicators as ind}
      <div class="health-row health-row--{ind.status}">
        <span class="health-row__dot" aria-hidden="true"></span>
        <span class="health-row__label">{ind.label}</span>
        {#if ind.note !== undefined}
          <span class="health-row__note">{ind.note}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .health-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .health-panel__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 16px 0;
  }

  /* ─── Row ─────────────────────────────────────────────────────────────────── */

  .health-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-dim);
  }

  .health-row:last-child { border-bottom: none; }

  .health-row__dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-row--ok      .health-row__dot { background: var(--ready); box-shadow: 0 0 8px var(--ready); }
  .health-row--warn    .health-row__dot { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
  .health-row--unknown .health-row__dot { background: var(--text-dim); }

  .health-row__label {
    font-size: 15px;
    font-weight: 500;
    flex: 1;
  }

  .health-row--ok      .health-row__label { color: var(--text); }
  .health-row--warn    .health-row__label { color: var(--danger); }
  .health-row--unknown .health-row__label { color: var(--text-dim); }

  .health-row__note {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .health-row--warn .health-row__note { color: var(--danger); opacity: 0.7; }
</style>
