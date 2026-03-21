<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../../lib/auth.svelte.ts';
  import { api } from '../../lib/api.ts';
  import type { Participant } from '@shared/types';

  let participants = $state<Participant[]>([]);
  let loading      = $state(false);
  let error        = $state<string | null>(null);
  let search       = $state('');
  let busy         = $state<Set<string>>(new Set());

  const me = $derived(auth.participant);

  const filtered = $derived(() => {
    const q = search.trim().toLowerCase();
    return [...participants]
      .filter(p => !p.id.startsWith('system:'))
      .filter(p => !q || p.displayName.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.banned !== b.banned) return a.banned ? 1 : -1;
        if ((a.role === 'admin') !== (b.role === 'admin')) return a.role === 'admin' ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  });

  async function load() {
    loading = true;
    error = null;
    try {
      participants = await api.participants.list();
    } catch {
      error = 'Failed to load participants';
    } finally {
      loading = false;
    }
  }

  function setBusy(id: string, on: boolean) {
    const next = new Set(busy);
    on ? next.add(id) : next.delete(id);
    busy = next;
  }

  async function toggleAdmin(p: Participant) {
    if (p.id === me?.id) return;
    setBusy(p.id, true);
    try {
      const isAdmin = p.role === 'admin';
      await api.participants.setAdmin(p.id, !isAdmin);
      participants = participants.map(x =>
        x.id === p.id ? { ...x, role: isAdmin ? 'participant' : 'admin' } : x
      );
    } catch {
      error = 'Failed to update role';
    } finally {
      setBusy(p.id, false);
    }
  }

  async function toggleBan(p: Participant) {
    setBusy(p.id, true);
    try {
      if (p.banned) {
        await api.participants.unban(p.id);
        participants = participants.map(x => x.id === p.id ? { ...x, banned: false } : x);
      } else {
        await api.participants.ban(p.id);
        participants = participants.map(x => x.id === p.id ? { ...x, banned: true } : x);
      }
    } catch {
      error = 'Failed to update ban';
    } finally {
      setBusy(p.id, false);
    }
  }

  onMount(load);
</script>

<div class="participants-panel">
  <div class="participants-panel__toolbar">
    <input
      class="participants-panel__search"
      type="search"
      placeholder="Search…"
      bind:value={search}
    />
    <button class="participants-panel__refresh" onclick={load} disabled={loading} title="Refresh">↻</button>
  </div>

  {#if error}
    <div class="participants-panel__error">{error}</div>
  {/if}

  <div class="participants-panel__list">
    {#if loading}
      <p class="participants-panel__empty">Loading…</p>
    {:else if filtered().length === 0}
      <p class="participants-panel__empty">{search ? 'No match.' : 'No participants yet.'}</p>
    {:else}
      {#each filtered() as p (p.id)}
        {@const isAdmin  = p.role === 'admin'}
        {@const isSelf   = p.id === me?.id}
        {@const isBusy   = busy.has(p.id)}
        <div class="participant-row" class:participant-row--admin={isAdmin} class:participant-row--banned={p.banned}>
          <div class="participant-row__info">
            <span class="participant-row__name">{p.displayName}</span>
            <div class="participant-row__meta">
              {#if p.team}<span class="participant-row__team">{p.team}</span>{/if}
              {#if isAdmin}<span class="tag tag--admin">admin</span>{/if}
              {#if p.banned}<span class="tag tag--banned">banned</span>{/if}
            </div>
          </div>

          <div class="participant-row__actions">
            <button
              class="action-btn"
              class:action-btn--active={isAdmin}
              disabled={isBusy || isSelf}
              title={isSelf ? 'Cannot demote yourself' : isAdmin ? 'Revoke admin' : 'Grant admin'}
              onclick={() => toggleAdmin(p)}
            >
              {isAdmin ? 'Admin ✓' : 'Admin'}
            </button>

            <button
              class="action-btn action-btn--danger"
              class:action-btn--active={p.banned}
              disabled={isBusy || isSelf}
              title={p.banned ? 'Unban' : 'Ban'}
              onclick={() => toggleBan(p)}
            >
              {p.banned ? 'Unban' : 'Ban'}
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .participants-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  /* ─── Toolbar ─────────────────────────────────────────────── */

  .participants-panel__toolbar {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .participants-panel__search {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    color: var(--text);
    font-size: var(--font-size-base);
    padding: 4px 8px;
    font-family: var(--font, sans-serif);
  }

  .participants-panel__search:focus {
    outline: none;
    border-color: var(--accent);
  }

  .participants-panel__refresh {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-size-md);
    cursor: pointer;
    padding: 0 4px;
    border-radius: var(--radius);
    line-height: 1;
  }

  .participants-panel__refresh:hover:not(:disabled) { color: var(--text); }
  .participants-panel__refresh:disabled { opacity: 0.4; cursor: default; }

  .participants-panel__error {
    padding: 5px 10px;
    font-size: var(--font-size-base);
    color: var(--live);
    background: rgba(229, 57, 53, 0.08);
    flex-shrink: 0;
  }

  /* ─── List ────────────────────────────────────────────────── */

  .participants-panel__list {
    flex: 1;
    overflow-y: auto;
  }

  .participants-panel__empty {
    padding: 24px;
    font-size: var(--font-size-base);
    color: var(--text-dim);
    text-align: center;
  }

  /* ─── Row ─────────────────────────────────────────────────── */

  .participant-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border-dim);
  }

  .participant-row:last-child { border-bottom: none; }

  .participant-row--admin   { background: rgba(232, 124, 42, 0.04); }
  .participant-row--banned  { opacity: 0.55; }

  .participant-row__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .participant-row__name {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .participant-row__meta {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .participant-row__team {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .tag {
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: var(--radius);
  }

  .tag--admin  { background: rgba(232, 124, 42, 0.2); color: var(--accent); }
  .tag--banned { background: rgba(229, 57, 53, 0.2);  color: var(--live);   }

  /* ─── Action buttons ──────────────────────────────────────── */

  .participant-row__actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm);
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.1s, border-color 0.1s, background 0.1s;
  }

  .action-btn:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
  }

  .action-btn--active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(232, 124, 42, 0.1);
  }

  .action-btn--danger:hover:not(:disabled) {
    color: var(--live);
    border-color: var(--live);
  }

  .action-btn--danger.action-btn--active {
    color: var(--live);
    border-color: var(--live);
    background: rgba(229, 57, 53, 0.1);
  }

  .action-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
