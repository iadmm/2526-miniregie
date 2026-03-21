<script lang="ts">
  import { socketState } from '../../lib/socket.svelte.ts';
  import { api } from '../../lib/api.ts';
  import type { MediaItem } from '@shared/types';
  import OnAirRow from './OnAirRow.svelte';

  const activeIds = $derived(socketState.globalState?.broadcast.activeItemIds ?? []);
  const regime    = $derived(socketState.globalState?.broadcast.regime ?? 'normal');
  const snapshot  = $derived(socketState.globalState?.pool.queueSnapshot ?? []);
  const activeApp = $derived(socketState.globalState?.broadcast.activeApp ?? '');

  const primary   = $derived<MediaItem | null>(
    activeIds[0] ? (snapshot.find(i => i.id === activeIds[0]) ?? null) : null,
  );
  const companion = $derived<MediaItem | null>(
    activeIds[1] ? (snapshot.find(i => i.id === activeIds[1]) ?? null) : null,
  );

  // ── Layout derivation ────────────────────────────────────────────────────────

  const LAYOUT_LABEL: Record<string, string> = {
    IDLE:                'idle',
    MEDIA_FULL:          'media full',
    MEDIA_WITH_VISUAL:   'media + visual',
    MEDIA_WITH_CAPTION:  'media + note',
    VISUAL_FULL:         'visual full',
    VISUAL_WITH_CAPTION: 'visual + note',
    NOTE_CARD:           'note card',
  };

  const layout = $derived.by(() => {
    if (!primary) return 'IDLE';
    if (primary.type === 'youtube') {
      if (!companion) return 'MEDIA_FULL';
      return companion.type === 'note' ? 'MEDIA_WITH_CAPTION' : 'MEDIA_WITH_VISUAL';
    }
    if (primary.type === 'note') return 'NOTE_CARD';
    return companion ? 'VISUAL_WITH_CAPTION' : 'VISUAL_FULL';
  });

  // ── Duration helpers ─────────────────────────────────────────────────────────

  const DURATIONS: Record<string, { normal: number; extended: number }> = {
    photo: { normal: 20_000, extended: 45_000 },
    gif:   { normal: 20_000, extended: 45_000 },
    clip:  { normal: 20_000, extended: 45_000 },
    note:  { normal: 12_000, extended: 30_000 },
  };

  const COMPANION_DUR: Record<string, number> = {
    photo: 20_000, gif: 20_000, clip: 20_000, note: 12_000,
  };

  function getPrimaryDuration(item: MediaItem): number | null {
    if (item.type === 'youtube') return null;
    if (item.type === 'clip') return Math.max((item.content as { duration: number }).duration * 1_000, 4_000);
    const d = DURATIONS[item.type];
    if (!d) return null;
    return regime === 'hold' ? d.extended : d.normal;
  }

  function getCompanionDuration(item: MediaItem): number | null {
    return COMPANION_DUR[item.type] ?? null;
  }

  // ── Progress tracking ────────────────────────────────────────────────────────

  let primaryStartedAt:   number | null = $state(null);
  let companionStartedAt: number | null = $state(null);
  let now = $state(Date.now());

  let prevPrimaryId:   string | null = null;
  let prevCompanionId: string | null = null;

  $effect(() => {
    const pid = activeIds[0] ?? null;
    const cid = activeIds[1] ?? null;
    if (pid !== prevPrimaryId) {
      prevPrimaryId    = pid;
      primaryStartedAt = pid ? Date.now() : null;
    }
    if (cid !== prevCompanionId) {
      prevCompanionId    = cid;
      companionStartedAt = cid ? Date.now() : null;
    }
  });

  $effect(() => {
    if (!primary) return;
    const timer = setInterval(() => { now = Date.now(); }, 250);
    return () => clearInterval(timer);
  });

  const primaryProgress = $derived.by((): number | null => {
    if (!primary || primaryStartedAt === null) return null;
    const dur = getPrimaryDuration(primary);
    if (dur === null) return null;
    return Math.min((now - primaryStartedAt) / dur, 1);
  });

  const primaryTimeLeft = $derived.by((): number | null => {
    if (!primary || primaryStartedAt === null) return null;
    const dur = getPrimaryDuration(primary);
    if (dur === null) return null;
    return Math.max(0, Math.round((dur - (now - primaryStartedAt)) / 1000));
  });

  const companionProgress = $derived.by((): number | null => {
    if (!companion || companionStartedAt === null) return null;
    const dur = getCompanionDuration(companion);
    if (dur === null) return null;
    return Math.min((now - companionStartedAt) / dur, 1);
  });

  const companionTimeLeft = $derived.by((): number | null => {
    if (!companion || companionStartedAt === null) return null;
    const dur = getCompanionDuration(companion);
    if (dur === null) return null;
    return Math.max(0, Math.round((dur - (now - companionStartedAt)) / 1000));
  });

  // ── Actions ──────────────────────────────────────────────────────────────────

  let skipping = $state(false);

  async function skipScene() {
    if (!primary || skipping) return;
    skipping = true;
    try {
      await api.items.skip(primary.id);
    } finally {
      skipping = false;
    }
  }
</script>

<div class="on-air-panel">
  <div class="on-air-panel__header panel-header">
    <span class="panel-label">On Air</span>
    <div class="on-air-panel__badges">
      {#if activeApp === 'jam-mode' && primary}
        <span class="on-air-panel__layout">{LAYOUT_LABEL[layout] ?? layout}</span>
      {/if}
      {#if activeApp === 'jam-mode'}
        <span class="on-air-panel__regime on-air-panel__regime--{regime}">{regime}</span>
      {/if}
    </div>
  </div>

  <div class="on-air-panel__body panel-body">
    {#if activeApp !== 'jam-mode'}
      <p class="on-air-panel__msg">JAM mode not active — <span class="on-air-panel__app">{activeApp}</span></p>
    {:else if !primary}
      <p class="on-air-panel__msg on-air-panel__msg--hold">
        {snapshot.length === 0 ? 'Queue empty — hold' : `Hold — ${snapshot.length} item${snapshot.length > 1 ? 's' : ''} queued`}
      </p>
    {:else}

      <OnAirRow
        role="primary"
        item={primary}
        progress={primaryProgress}
        timeLeft={primaryTimeLeft}
      />
      <OnAirRow
        role="companion"
        item={companion}
        progress={companionProgress}
        timeLeft={companionTimeLeft}
      />

      <div class="on-air-panel__actions">
        <button
          class="on-air-panel__btn on-air-panel__btn--skip"
          onclick={skipScene}
          disabled={skipping}
        >{skipping ? '…' : 'Skip scene'}</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .on-air-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .on-air-panel__badges {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .on-air-panel__layout {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .on-air-panel__regime {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: var(--radius);
  }

  .on-air-panel__regime--normal { color: var(--ready);   background: color-mix(in srgb, var(--ready) 12%, transparent); }
  .on-air-panel__regime--hold   { color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
  .on-air-panel__regime--buffer { color: var(--accent);  background: color-mix(in srgb, var(--accent) 12%, transparent); }

  .on-air-panel__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .on-air-panel__msg {
    font-size: var(--font-size-md);
    color: var(--text-dim);
    text-align: center;
    margin-top: 32px;
    padding: 0 12px;
  }

  .on-air-panel__msg--hold { color: var(--warning); }

  .on-air-panel__app {
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  /* ─── Actions ─────────────────────────────────────────────────────────────── */

  .on-air-panel__actions {
    margin-top: auto;
    padding: 10px 12px;
    display: flex;
    gap: 8px;
  }

  .on-air-panel__btn {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: var(--radius);
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .on-air-panel__btn--skip {
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
  }

  .on-air-panel__btn--skip:hover:not(:disabled) {
    color: var(--danger);
    border-color: var(--danger);
  }

  .on-air-panel__btn--skip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
