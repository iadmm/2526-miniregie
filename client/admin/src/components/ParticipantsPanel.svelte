<script lang="ts">
  import { api } from '../lib/api.ts';
  import type { Participant } from '@shared/types';

  // ─── State ──────────────────────────────────────────────────────────────────

  let participants = $state<Participant[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let searchDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  let actionLoading = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  // Ban reason input per participant (keyed by id)
  let banReasons = $state<Record<string, string>>({});

  // ─── Load ────────────────────────────────────────────────────────────────────

  async function loadParticipants(q?: string): Promise<void> {
    loading = true;
    error = null;
    try {
      participants = await api.participants.list(q);
    } catch (err) {
      const apiErr = err as { error?: string };
      error = apiErr.error ?? 'Erreur de chargement.';
    } finally {
      loading = false;
    }
  }

  // Initial load
  $effect(() => {
    void loadParticipants();
  });

  // Debounced search
  function handleSearchInput(): void {
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      void loadParticipants(searchQuery.trim() || undefined);
    }, 300);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function doAction(id: string, fn: () => Promise<unknown>): Promise<void> {
    actionLoading = id;
    actionError = null;
    try {
      await fn();
      await loadParticipants(searchQuery.trim() || undefined);
    } catch (err) {
      const apiErr = err as { error?: string };
      actionError = apiErr.error ?? 'Erreur.';
    } finally {
      actionLoading = null;
    }
  }

  function handleBan(p: Participant): void {
    const reason = banReasons[p.id]?.trim() || undefined;
    const confirmMsg = reason
      ? `Bannir ${p.displayName} ? Raison: "${reason}"`
      : `Bannir ${p.displayName} ? (sans raison spécifiée)`;
    if (!confirm(confirmMsg)) return;
    doAction(p.id, () => api.participants.ban(p.id, reason));
    // Clear reason input after ban
    banReasons = { ...banReasons, [p.id]: '' };
  }

  function handleUnban(p: Participant): void {
    if (!confirm(`Débannir ${p.displayName} ?`)) return;
    doAction(p.id, () => api.participants.unban(p.id));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function formatDate(ts: number | null): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="panel">
  <div class="toolbar">
    <input
      type="text"
      bind:value={searchQuery}
      oninput={handleSearchInput}
      placeholder="Rechercher par nom, équipe, identifiant…"
      class="search-input"
    />
    <span class="participant-count">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
  </div>

  {#if actionError}
    <div class="error-msg" style="margin-bottom: 8px;">{actionError}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if participants.length === 0}
    <div class="loading">Aucun participant trouvé.</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Avatar</th>
            <th>Identifiant</th>
            <th>Nom</th>
            <th>Équipe</th>
            <th>Rôle</th>
            <th>Statut</th>
            <th>Vu la dernière fois</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each participants as p (p.id)}
            <tr class:banned={p.banned}>
              <td class="col-avatar">
                {#if p.avatarUrl}
                  <img src={p.avatarUrl} alt={p.displayName} class="avatar" />
                {:else}
                  <div class="avatar-placeholder">{p.displayName[0] ?? '?'}</div>
                {/if}
              </td>
              <td class="col-username">
                <code class="username">{p.username ?? p.id}</code>
              </td>
              <td class="col-name">
                <span class="display-name">{p.displayName}</span>
              </td>
              <td class="col-team">
                {#if p.team}
                  {p.team}
                {:else}
                  <span class="text-dim">—</span>
                {/if}
              </td>
              <td class="col-role">
                <code class="role-badge">{p.role}</code>
              </td>
              <td class="col-status">
                {#if p.banned}
                  <span class="badge badge-banned" title={p.banReason ?? undefined}>
                    Banni {p.banReason ? `(${p.banReason.slice(0, 20)})` : ''}
                  </span>
                {:else}
                  <span class="badge badge-ready">Actif</span>
                {/if}
              </td>
              <td class="col-time">
                <span title={new Date(p.lastSeenAt).toLocaleString()}>
                  {formatDate(p.lastSeenAt)}
                </span>
              </td>
              <td class="col-actions">
                {#if !p.banned}
                  <div class="ban-row">
                    <input
                      type="text"
                      bind:value={banReasons[p.id]}
                      placeholder="Raison (optionnel)"
                      class="ban-reason-input"
                    />
                    <button
                      class="btn btn-danger btn-sm"
                      onclick={() => handleBan(p)}
                      disabled={actionLoading === p.id}
                    >
                      {actionLoading === p.id ? '…' : 'Bannir'}
                    </button>
                  </div>
                {:else}
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => handleUnban(p)}
                    disabled={actionLoading === p.id}
                  >
                    {actionLoading === p.id ? '…' : 'Débannir'}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .panel {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .search-input {
    min-width: 300px;
    font-size: 13px;
  }

  .participant-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .col-avatar { width: 44px; }
  .col-username { width: 120px; }
  .col-name { min-width: 120px; }
  .col-team { width: 100px; font-size: 12px; }
  .col-role { width: 100px; }
  .col-status { width: 120px; }
  .col-time { width: 110px; font-size: 12px; color: var(--text-muted); }
  .col-actions { min-width: 200px; }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-raised);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .username {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .display-name {
    font-weight: 500;
  }

  .role-badge {
    font-size: 11px;
    font-family: var(--font-mono);
    background: var(--bg-raised);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--accent);
  }

  .ban-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .ban-reason-input {
    font-size: 12px;
    padding: 4px 8px;
    width: 130px;
  }

  .text-dim { color: var(--text-dim); }

  tr.banned td {
    opacity: 0.6;
  }
</style>