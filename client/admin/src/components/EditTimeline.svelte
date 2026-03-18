<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import { scheduleState, refreshSchedule } from '../lib/schedule.svelte.ts';
  import { APP_COLORS } from '../lib/app-utils.ts';

  const jam      = $derived(socketState.globalState?.jam);
  const snapshot = $derived(socketState.globalState?.pool.queueSnapshot ?? []);

  // ─── NOW marker ───────────────────────────────────────────────────────────
  let nowPx = $state(0);

  $effect(() => {
    function updateNow() {
      if (!jam?.startedAt) { nowPx = 0; return; }
      nowPx = ((Date.now() - jam.startedAt) / (48 * 3600 * 1000)) * 4800;
    }
    updateNow();
    const t = setInterval(updateNow, 1000);
    return () => clearInterval(t);
  });

  // ─── Schedule ─────────────────────────────────────────────────────────────
  $effect(() => {
    refreshSchedule();
  });

  $effect(() => {
    if (jam?.status !== 'running') return;
    const t = setInterval(refreshSchedule, 5000);
    return () => clearInterval(t);
  });

  function parseHHMMSS(s: string): number {
    const parts = s.split(':').map(Number);
    const h   = parts[0] ?? 0;
    const m   = parts[1] ?? 0;
    const sec = parts[2] ?? 0;
    return ((h * 3600) + (m * 60) + sec) * 1000;
  }

  function resolveOffsetPx(at: string, startedAt: number | null, endsAt: number | null): number | null {
    const PX_PER_MS = 4800 / (48 * 3600 * 1000);
    if (at.startsWith('H+')) {
      if (!startedAt) return null;
      return parseHHMMSS(at.slice(2)) * PX_PER_MS;
    }
    if (at.startsWith('T-')) {
      if (!endsAt || !startedAt) return null;
      return (endsAt - parseHHMMSS(at.slice(2)) - startedAt) * PX_PER_MS;
    }
    // ISO absolute
    const anchor = startedAt ?? Date.now();
    return (Date.parse(at) - anchor) * PX_PER_MS;
  }

  function typeColor(type: string): string {
    const map: Record<string, string> = {
      photo: '#3b82f6', gif: '#8b5cf6', clip: '#ef4444',
      note: '#22c55e', link: '#f59e0b', youtube: '#ef4444',
      interview: '#e87c2a', ticker: '#06b6d4',
    };
    return map[type] ?? '#555';
  }
</script>

<div class="edit-timeline">
  <div class="timeline-header">
    <span class="panel-label">Timeline</span>
    {#if jam?.startedAt}
      <span class="timeline-info mono">
        H+{Math.floor((Date.now() - jam.startedAt) / 60_000)}min
      </span>
    {/if}
  </div>

  <div class="timeline-body">
    <!-- Ruler -->
    <div class="ruler">
      <div class="ruler-track">
        {#each {length: 49} as _, i}
          <div class="ruler-mark" style="left:{(i/48)*100}%">
            <span class="ruler-label">H+{String(i).padStart(2,'0')}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Track: broadcast events (past) -->
    <div class="track">
      <div class="track-label">Diffusé</div>
      <div class="track-content">
        <div class="placeholder-track">
          <span>Historique des items diffusés — à connecter sur broadcast_events</span>
        </div>
      </div>
    </div>

    <!-- Track: queue (upcoming) -->
    <div class="track">
      <div class="track-label">Queue</div>
      <div class="track-content">
        {#if snapshot.length === 0}
          <div class="placeholder-track"><span>Pool vide</span></div>
        {:else}
          <div class="queue-items">
            {#each snapshot as item (item.id)}
              <div class="queue-item" style="border-color:{typeColor(item.type)}" title={item.type}>
                <span class="item-type" style="background:{typeColor(item.type)}">{item.type}</span>
                <span class="item-author">{item.author.displayName || '?'}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Track: schedule triggers -->
    <div class="track">
      <div class="track-label">Schedule</div>
      <div class="track-content schedule-content">
        {#if scheduleState.entries.length === 0}
          <div class="placeholder-track"><span>Aucune entrée schedule</span></div>
        {:else}
          {#each scheduleState.entries as entry (entry.id)}
            {@const px = resolveOffsetPx(entry.at, jam?.startedAt ?? null, jam?.endsAt ?? null)}
            {#if px !== null}
              <div
                class="schedule-marker"
                class:fired={entry.status === 'fired'}
                class:skipped={entry.status === 'skipped'}
                style="left: {px}px; --color: {APP_COLORS[entry.app] ?? '#888'}"
                title="{entry.app}{entry.label ? ': ' + entry.label : ''} [{entry.at}]"
              >
                <div class="marker-pin"></div>
                <div class="marker-pill">{entry.label ?? entry.app}</div>
              </div>
            {:else}
              <div
                class="schedule-marker unresolved"
                style="--color: {APP_COLORS[entry.app] ?? '#888'}"
                title="{entry.app} — position indéterminée (JAM pas démarré)"
              >
                <div class="marker-pill">{entry.label ?? entry.app}</div>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>

    <!-- NOW marker -->
    <div class="now-marker" style="left:{nowPx}px">
      <div class="now-line"></div>
      <span class="now-label">NOW</span>
    </div>
  </div>
</div>

<style>
  .edit-timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #111111;
    overflow: hidden;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
    height: 26px;
  }

  .timeline-info { font-size: 11px; color: var(--text-muted); }

  .timeline-body {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
    min-width: 0;
  }

  /* Ruler */
  .ruler {
    height: 24px;
    background: #0d0d0d;
    border-bottom: 1px solid var(--border-dim);
    position: sticky;
    top: 0;
    z-index: 2;
    overflow: hidden;
  }

  .ruler-track {
    position: relative;
    width: 4800px; /* 48h × 100px/h */
    height: 100%;
  }

  .ruler-mark {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    border-left: 1px solid var(--border-dim);
  }

  .ruler-label {
    font-size: 8px;
    color: var(--text-dim);
    font-family: var(--font-mono);
    padding: 3px 2px;
    white-space: nowrap;
  }

  /* Tracks */
  .track {
    display: flex;
    align-items: stretch;
    height: 36px;
    border-bottom: 1px solid var(--border-dim);
  }

  .track-label {
    width: 72px;
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: #161616;
    border-right: 1px solid var(--border-dim);
  }

  .track-content {
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
  }

  .placeholder-track {
    padding: 0 10px;
    font-size: 10px;
    color: var(--text-dim);
    font-style: italic;
    white-space: nowrap;
  }

  .queue-items {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    overflow-x: auto;
    height: 100%;
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    border-left-width: 2px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .item-type {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    color: #fff;
    padding: 1px 3px;
    border-radius: 1px;
  }

  .item-author {
    font-size: 10px;
    color: var(--text-muted);
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Schedule track */
  .schedule-content {
    overflow: visible;
  }

  .schedule-marker {
    position: absolute;
    top: 2px;
    bottom: 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    transform: translateX(-50%);
    pointer-events: auto;
    cursor: default;
  }

  .schedule-marker.unresolved {
    position: relative;
    opacity: 0.4;
    transform: none;
    left: auto !important;
    flex-direction: row;
    gap: 0;
  }

  .marker-pin {
    width: 1.5px;
    flex: 1;
    background: var(--color, #888);
    min-height: 4px;
  }

  .marker-pill {
    font-size: 7px;
    padding: 1px 3px;
    border-radius: 2px;
    white-space: nowrap;
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }

  /* pending: dashed outline */
  .schedule-marker:not(.fired):not(.skipped) .marker-pill {
    border: 1.5px dashed var(--color, #888);
    color: var(--color, #888);
    background: transparent;
  }

  /* fired: solid */
  .schedule-marker.fired .marker-pin { background: var(--color, #888); }
  .schedule-marker.fired .marker-pill {
    background: var(--color, #888);
    color: #fff;
  }

  /* skipped */
  .schedule-marker.skipped {
    opacity: 0.4;
  }
  .schedule-marker.skipped .marker-pill {
    background: var(--color, #888);
    color: #fff;
    text-decoration: line-through;
  }

  /* NOW marker */
  .now-marker {
    position: absolute;
    top: 24px; /* below ruler */
    bottom: 0;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 3;
  }

  .now-line {
    width: 2px;
    height: 100%;
    background: var(--live);
    box-shadow: 0 0 6px var(--live-glow);
  }

  .now-label {
    position: absolute;
    top: 0;
    left: 3px;
    font-size: 8px;
    font-weight: 700;
    color: var(--live);
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
</style>
