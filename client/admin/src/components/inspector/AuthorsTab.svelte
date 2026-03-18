<script lang="ts">
  import { onDestroy } from 'svelte';
  import { api, type ApiError } from '../../lib/api.ts';
  import type { AuthorStats } from '@shared/types';

  // ─── State ─────────────────────────────────────────────────────────────────

  let authors   = $state<AuthorStats[]>([]);
  let loading   = $state(false);
  let error     = $state<string | null>(null);

  // Live clock for cooldown countdowns — single interval, not per-row
  let now = $state(Date.now());
  const clockInterval = setInterval(() => { now = Date.now(); }, 1000);
  onDestroy(() => clearInterval(clockInterval));

  // ─── Load ───────────────────────────────────────────────────────────────────

  async function loadAuthors(): Promise<void> {
    loading = true;
    error   = null;
    try {
      authors = await api.pool.authors();
    } catch (e) {
      error = (e as ApiError).error ?? 'Load error';
    } finally {
      loading = false;
    }
  }

  // Initial load + polling every 10 s
  $effect(() => {
    void loadAuthors();
    const t = setInterval(() => { void loadAuthors(); }, 10_000);
    return () => clearInterval(t);
  });

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function ban(author: AuthorStats): Promise<void> {
    const reason = window.prompt(`Reason for banning ${author.displayName}:`);
    if (reason === null) return; // cancelled
    try {
      await api.participants.ban(author.id, reason.trim() || undefined);
      await loadAuthors();
    } catch (e) {
      error = (e as ApiError).error ?? 'Ban error';
    }
  }

  async function unban(author: AuthorStats): Promise<void> {
    try {
      await api.participants.unban(author.id);
      await loadAuthors();
    } catch (e) {
      error = (e as ApiError).error ?? 'Unban error';
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function formatCountdown(endsAt: number): string {
    const ms = endsAt - now;
    if (ms <= 0) return '';
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // An author is dominant if they have more than 4 ready items
  const DOMINANT_THRESHOLD = 4;
</script>

<div class="authors-tab">
  {#if error !== null}
    <div class="error-bar">{error}</div>
  {/if}

  <div class="tab-header">
    <span class="tab-label">Authors</span>
    <span class="author-count">{authors.length}</span>
    {#if loading}
      <span class="loading-dot"></span>
    {/if}
  </div>

  {#if authors.length === 0 && !loading}
    <div class="empty">No active authors</div>
  {:else}
    <div class="author-list">
      <!-- Header row -->
      <div class="author-row header-row">
        <span class="col-name">Author</span>
        <span class="col-team">Team</span>
        <span class="col-num" title="Ready items">Rdy</span>
        <span class="col-num" title="Displayed items">Dsp</span>
        <span class="col-num" title="Skipped items">Skp</span>
        <span class="col-cd">Cooldown</span>
        <span class="col-act">Action</span>
      </div>

      {#each authors as author (author.id)}
        {@const cdRemaining = author.cooldownEndsAt !== null ? author.cooldownEndsAt - now : null}
        {@const inCooldown  = cdRemaining !== null && cdRemaining > 0}
        {@const dominant    = author.readyCount > DOMINANT_THRESHOLD && !author.banned}

        <div
          class="author-row"
          class:banned={author.banned}
          class:dominant
          class:in-cooldown={inCooldown}
        >
          <span class="col-name">
            {#if dominant}
              <span class="badge-dominant" title="Dominant: more than {DOMINANT_THRESHOLD} ready items">DOM</span>
            {/if}
            <span class="author-name" class:banned-name={author.banned}>
              @{author.displayName}
            </span>
          </span>

          <span class="col-team">{author.team || '—'}</span>

          <span class="col-num" class:high={author.readyCount > DOMINANT_THRESHOLD}>
            {author.readyCount}
          </span>
          <span class="col-num">{author.displayedCount}</span>
          <span class="col-num">{author.skippedCount}</span>

          <span class="col-cd">
            {#if inCooldown && cdRemaining !== null}
              <span class="cooldown-timer">{formatCountdown(author.cooldownEndsAt!)}</span>
            {:else}
              <span class="cooldown-ok">—</span>
            {/if}
          </span>

          <span class="col-act">
            {#if author.banned}
              <button
                class="btn-action unban"
                onclick={() => unban(author)}
                title="Unban {author.displayName}"
              >Unban</button>
            {:else}
              <button
                class="btn-action ban"
                onclick={() => ban(author)}
                title="Ban {author.displayName}"
              >Ban</button>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .authors-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Error bar ───────────────────────────────────────────────────────────── */

  .error-bar {
    background: #2d1111;
    color: var(--live, #ef4444);
    font-size: 10px;
    padding: 5px 10px;
    border-bottom: 1px solid var(--live, #ef4444);
    flex-shrink: 0;
  }

  /* ── Tab header ──────────────────────────────────────────────────────────── */

  .tab-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .tab-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .author-count {
    font-size: 10px;
    font-family: var(--font-mono), monospace;
    color: var(--text-muted);
  }

  .loading-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    animation: loading-pulse 1s ease-in-out infinite;
    margin-left: auto;
  }

  @keyframes loading-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }

  /* ── Author list ─────────────────────────────────────────────────────────── */

  .author-list {
    flex: 1;
    overflow-y: auto;
  }

  .author-row {
    display: grid;
    grid-template-columns: 1fr 56px 28px 28px 28px 52px 50px;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-bottom: 1px solid var(--border-dim);
    transition: background 0.1s;
  }

  .author-row:hover:not(.header-row) { background: var(--bg-hover); }

  .header-row {
    background: var(--bg-panel);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-dim);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .author-row.banned    { opacity: 0.5; }
  .author-row.dominant  { background: rgba(245, 158, 11, 0.05); }

  /* ── Column cells ────────────────────────────────────────────────────────── */

  .col-name {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
  }

  .author-name {
    font-size: 10px;
    color: var(--accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }

  .author-name.banned-name {
    text-decoration: line-through;
    color: var(--text-dim);
  }

  .badge-dominant {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 1px 3px;
    border-radius: 2px;
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.4);
    flex-shrink: 0;
  }

  .col-team {
    font-size: 9px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-num {
    font-size: 10px;
    font-family: var(--font-mono), monospace;
    font-weight: 700;
    color: var(--text-muted);
    text-align: center;
  }

  .col-num.high { color: #f59e0b; }

  .col-cd {
    font-size: 9px;
    text-align: center;
  }

  .cooldown-timer {
    font-family: var(--font-mono), monospace;
    color: #f59e0b;
    font-size: 9px;
  }

  .cooldown-ok {
    color: var(--text-dim);
    font-size: 9px;
  }

  .col-act {
    display: flex;
    justify-content: center;
  }

  /* ── Action buttons ──────────────────────────────────────────────────────── */

  .btn-action {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: opacity 0.12s;
  }

  .btn-action.ban {
    background: rgba(239, 68, 68, 0.1);
    color: var(--live, #ef4444);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .btn-action.ban:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.6);
  }

  .btn-action.unban {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .btn-action.unban:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.6);
  }

  /* ── Empty ───────────────────────────────────────────────────────────────── */

  .empty {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }
</style>
