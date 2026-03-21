<script lang="ts">
  import { api } from '../../lib/api.ts';
  import type { Participant } from '@shared/types';

  interface Props {
    me: Participant;
  }

  const { me }: Props = $props();

  let participants = $state<Participant[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let toggling = $state<Set<string>>(new Set());

  async function load(): Promise<void> {
    loading = true;
    error = null;
    try {
      const all = await api.participants.list();
      // Hide phantom system accounts from the management list
      participants = all.filter(p => !p.id.startsWith('system:'));
    } catch {
      error = 'Failed to load participants';
    } finally {
      loading = false;
    }
  }

  $effect(() => { void load(); });

  async function toggleAdmin(p: Participant, isAdmin: boolean): Promise<void> {
    toggling = new Set([...toggling, p.id]);
    error = null;
    try {
      await api.participants.setAdmin(p.id, isAdmin);
      participants = participants.map(x =>
        x.id === p.id ? { ...x, role: isAdmin ? 'admin' : 'participant' } : x
      );
    } catch (err) {
      const e = err as { error?: string };
      error = e.error ?? 'Error updating role';
    } finally {
      const next = new Set(toggling);
      next.delete(p.id);
      toggling = next;
    }
  }

  const sorted = $derived(
    [...participants].sort((a, b) => {
      // Admins first, then alphabetically
      if ((a.role === 'admin') !== (b.role === 'admin')) return a.role === 'admin' ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    })
  );
</script>

<div class="participants-tab">
  <div class="tab-header">
    <span class="tab-title">Participants</span>
    <button class="btn-icon" onclick={() => load()} disabled={loading} title="Refresh">
      ↻
    </button>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else if sorted.length === 0}
    <div class="empty">No participants yet.</div>
  {:else}
    <ul class="participant-list">
      {#each sorted as p (p.id)}
        {@const isAdmin = p.role === 'admin'}
        {@const isSelf = p.id === me.id}
        {@const busy = toggling.has(p.id)}
        <li class="participant-row" class:is-admin={isAdmin}>
          <div class="participant-info">
            <span class="participant-name">{p.displayName}</span>
            {#if p.team}
              <span class="participant-team">{p.team}</span>
            {/if}
            {#if p.banned}
              <span class="badge badge-banned">banned</span>
            {/if}
          </div>
          <label
            class="admin-toggle"
            title={isSelf ? 'Cannot remove your own admin privileges' : isAdmin ? 'Revoke admin' : 'Grant admin'}
          >
            <input
              type="checkbox"
              checked={isAdmin}
              disabled={busy || isSelf}
              onchange={(e) => toggleAdmin(p, (e.target as HTMLInputElement).checked)}
            />
            <span class="toggle-label">admin</span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .participants-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .tab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .tab-title {
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .btn-icon {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-size-md);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius);
    line-height: 1;
  }

  .btn-icon:hover:not(:disabled) { color: var(--text); background: var(--bg-hover); }
  .btn-icon:disabled { opacity: 0.4; cursor: default; }

  .error-banner {
    padding: 6px 12px;
    background: color-mix(in srgb, var(--live) 15%, transparent);
    color: var(--live);
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  .loading,
  .empty {
    padding: 20px 12px;
    font-size: var(--font-size-base);
    color: var(--text-dim);
    text-align: center;
  }

  .participant-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1;
  }

  .participant-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    gap: 8px;
    border-bottom: 1px solid var(--border-dim);
  }

  .participant-row:last-child { border-bottom: none; }
  .participant-row.is-admin { background: color-mix(in srgb, var(--accent) 5%, transparent); }

  .participant-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .participant-name {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .participant-team {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .badge {
    display: inline-block;
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 3px;
    width: fit-content;
  }

  .badge-banned {
    background: color-mix(in srgb, var(--live) 20%, transparent);
    color: var(--live);
  }

  .admin-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .admin-toggle input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
    accent-color: var(--accent);
  }

  .admin-toggle input:disabled { cursor: not-allowed; opacity: 0.5; }

  .toggle-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
</style>
