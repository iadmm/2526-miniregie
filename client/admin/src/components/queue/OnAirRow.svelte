<script lang="ts">
  import type { MediaItem } from '@shared/types';
  import { TYPE_COLOR, TYPE_LABEL, itemLabel } from '../../lib/media.ts';

  interface Props {
    role: 'primary' | 'companion';
    item: MediaItem | null;
    progress: number | null;  // 0–1, null = indeterminate (e.g. youtube)
    timeLeft: number | null;  // seconds remaining, null = unknown
  }

  const { role, item, progress, timeLeft }: Props = $props();
</script>

<div class="on-air-row on-air-row--{role}" class:on-air-row--empty={!item}>
  <div class="on-air-row__header">
    <span class="on-air-row__role">{role}</span>
    {#if item}
      <span
        class="on-air-row__type"
        style="color:{TYPE_COLOR[item.type] ?? 'var(--text-muted)'}"
      >{TYPE_LABEL[item.type] ?? item.type}</span>
      <span class="on-air-row__author">{item.author.displayName}</span>
      <span class="on-air-row__team">{item.author.team}</span>
    {:else}
      <span class="on-air-row__none">—</span>
    {/if}
  </div>

  {#if item}
    <p class="on-air-row__content">{itemLabel(item)}</p>

    <div class="on-air-row__footer">
      <div class="on-air-row__track">
        {#if progress !== null}
          <div class="on-air-row__fill" style="width:{progress * 100}%"></div>
        {:else}
          <div class="on-air-row__fill on-air-row__fill--indeterminate"></div>
        {/if}
      </div>
      <span class="on-air-row__time">
        {#if timeLeft !== null}{timeLeft}s{:else}—{/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .on-air-row {
    padding: 8px 12px 0;
    border-bottom: 1px solid var(--border-dim);
    border-left: 3px solid transparent;
  }

  .on-air-row--primary   { border-left-color: var(--live); }
  .on-air-row--companion { border-left-color: var(--accent-dim, var(--accent)); opacity: 0.9; }
  .on-air-row--empty     { opacity: 0.35; }

  /* ─── Header ─────────────────────────────────────────────────────────────── */

  .on-air-row__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .on-air-row__role {
    font-family: var(--font-mono), monospace;
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    flex-shrink: 0;
    min-width: 56px; /* align type badges across rows */
  }

  .on-air-row__type {
    font-family: var(--font-mono), monospace;
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .on-air-row__author {
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .on-air-row__team {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .on-air-row__none {
    font-size: var(--font-size-md);
    color: var(--text-dim);
  }

  /* ─── Content preview ────────────────────────────────────────────────────── */

  .on-air-row__content {
    font-size: var(--font-size-base);
    color: var(--text-muted);
    margin: 0 0 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── Progress footer ────────────────────────────────────────────────────── */

  .on-air-row__footer {
    display: flex;
    align-items: center;
    gap: 7px;
    padding-bottom: 8px;
  }

  .on-air-row__track {
    flex: 1;
    height: 2px;
    background: var(--border-dim);
    border-radius: 1px;
    overflow: hidden;
    position: relative;
  }

  .on-air-row__fill {
    height: 100%;
    border-radius: 1px;
    transition: width 0.25s linear;
  }

  .on-air-row--primary   .on-air-row__fill { background: var(--live); }
  .on-air-row--companion .on-air-row__fill { background: var(--accent); }

  /* Indeterminate scanning animation (youtube / unknown duration) */
  .on-air-row__fill--indeterminate {
    width: 35%;
    position: absolute;
    animation: scan 1.6s ease-in-out infinite;
  }

  @keyframes scan {
    0%   { left: -35%; }
    100% { left: 100%; }
  }

  .on-air-row__time {
    font-family: var(--font-mono), monospace;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-dim);
    flex-shrink: 0;
    min-width: 24px;
    text-align: right;
  }
</style>
