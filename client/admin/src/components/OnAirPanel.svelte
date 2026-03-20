<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import type { MediaItem } from '@shared/types';

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

  const TYPE_COLOR: Record<string, string> = {
    photo:     'var(--accent)',
    gif:       '#a855f7',
    note:      'var(--warning)',
    clip:      'var(--ready)',
    ticker:    'var(--accent-dim)',
    youtube:   'var(--live)',
    link:      'var(--text-muted)',
    interview: '#06b6d4',
  };

  function itemLabel(item: MediaItem): string {
    const c = item.content as Record<string, unknown>;
    if (typeof c.text === 'string') return c.text.slice(0, 80);
    if (typeof c.title === 'string') return c.title.slice(0, 80);
    if (typeof c.caption === 'string' && c.caption) return c.caption.slice(0, 80);
    return '—';
  }

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
    {#if activeApp === 'jam-mode'}
      <span class="on-air-panel__regime on-air-panel__regime--{regime}">{regime}</span>
    {/if}
  </div>

  <div class="on-air-panel__body panel-body">
    {#if activeApp !== 'jam-mode'}
      <p class="on-air-panel__msg">JAM mode not active — <span class="on-air-panel__app">{activeApp}</span></p>
    {:else if !primary}
      <p class="on-air-panel__msg on-air-panel__msg--hold">Queue empty — hold</p>
    {:else}

      <!-- PRIMARY -->
      <div class="on-air-row on-air-row--primary">
        <div class="on-air-row__role">PRIMARY</div>
        <div class="on-air-row__info">
          <span
            class="on-air-row__type"
            style="color:{TYPE_COLOR[primary.type] ?? 'var(--text-muted)'}"
          >{primary.type}</span>
          <span class="on-air-row__author">{primary.author.displayName}</span>
          <span class="on-air-row__team">{primary.author.team}</span>
        </div>
        <p class="on-air-row__content">{itemLabel(primary)}</p>
      </div>

      <!-- COMPANION -->
      <div class="on-air-row on-air-row--companion" class:on-air-row--empty={!companion}>
        <div class="on-air-row__role">COMPANION</div>
        {#if companion}
          <div class="on-air-row__info">
            <span
              class="on-air-row__type"
              style="color:{TYPE_COLOR[companion.type] ?? 'var(--text-muted)'}"
            >{companion.type}</span>
            <span class="on-air-row__author">{companion.author.displayName}</span>
            <span class="on-air-row__team">{companion.author.team}</span>
          </div>
          <p class="on-air-row__content">{itemLabel(companion)}</p>
        {:else}
          <span class="on-air-row__none">—</span>
        {/if}
      </div>

      <!-- Actions -->
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

  .on-air-panel__regime {
    font-family: var(--font-mono);
    font-size: 10px;
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
    font-size: 12px;
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

  /* ─── Row ─────────────────────────────────────────────────────────────────── */

  .on-air-row {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-dim);
  }

  .on-air-row--primary {
    border-left: 3px solid var(--live);
  }

  .on-air-row--companion {
    border-left: 3px solid var(--accent-dim, var(--accent));
    opacity: 0.85;
  }

  .on-air-row--empty {
    opacity: 0.4;
  }

  .on-air-row__role {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  .on-air-row__info {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 3px;
  }

  .on-air-row__type {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .on-air-row__author {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
  }

  .on-air-row__team {
    font-size: 11px;
    color: var(--text-muted);
  }

  .on-air-row__content {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .on-air-row__none {
    font-size: 12px;
    color: var(--text-dim);
  }

  /* ─── Actions ─────────────────────────────────────────────────────────────── */

  .on-air-panel__actions {
    padding: 10px 12px;
    display: flex;
    gap: 8px;
  }

  .on-air-panel__btn {
    font-family: var(--font-mono);
    font-size: 10px;
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
