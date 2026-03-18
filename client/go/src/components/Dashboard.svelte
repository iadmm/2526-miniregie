<script lang="ts">
  import { api, isApiError } from '../lib/api.js';
  import { participantState } from '../lib/stores.js';
  import SubmitForm from './SubmitForm.svelte';
  import MyItems from './MyItems.svelte';
  import type { Participant, MediaItem } from '@shared/types.js';

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    participant: Participant;
    onLogout: () => void;
  }
  const { participant, onLogout }: Props = $props();

  // ─── State ────────────────────────────────────────────────────────────────

  let jamStatus = $state<string>('idle');
  let myItems = $state<MediaItem[]>([]);
  let statusLoading = $state(true);

  // ─── Load status on mount ─────────────────────────────────────────────────

  $effect(() => {
    loadStatus();
  });

  async function loadStatus() {
    statusLoading = true;
    try {
      const data = await api.go.status();
      jamStatus = data.jamStatus;
      myItems = data.myItems;
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        onLogout();
      }
    } finally {
      statusLoading = false;
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async function handleLogout() {
    try {
      await api.auth.logout();
    } finally {
      participantState.value = null;
      onLogout();
    }
  }

  // ─── JAM status badge ─────────────────────────────────────────────────────

  const jamBadge = $derived(
    jamStatus === 'running'
      ? { label: 'JAM en cours', cls: 'running' }
      : jamStatus === 'ended'
        ? { label: 'JAM terminée', cls: 'ended' }
        : { label: 'JAM pas encore démarrée', cls: 'idle' },
  );
</script>

<div class="dashboard">
  <!-- Header -->
  <header class="dashboard-header">
    <div class="header-identity">
      {#if participant.avatarUrl}
        <img
          src={participant.avatarUrl}
          alt="Avatar de {participant.displayName}"
          class="avatar"
        />
      {:else}
        <div class="avatar avatar-placeholder">
          {participant.displayName.charAt(0).toUpperCase()}
        </div>
      {/if}
      <div class="identity-text">
        <span class="display-name">{participant.displayName}</span>
        {#if participant.team}
          <span class="team">{participant.team}</span>
        {/if}
      </div>
    </div>
    <div class="header-right">
      <span class="jam-badge jam-badge--{jamBadge.cls}">{jamBadge.label}</span>
      <button class="btn-logout" onclick={handleLogout} title="Se déconnecter">
        Déco
      </button>
    </div>
  </header>

  <!-- Main content -->
  <main class="dashboard-main">
    <SubmitForm
      {jamStatus}
      onSubmitted={() => loadStatus()}
    />

    <div class="divider"></div>

    {#if statusLoading}
      <p class="loading-hint">Chargement…</p>
    {:else}
      <MyItems items={myItems} />
    {/if}
  </main>
</div>

<style>
  .dashboard {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .dashboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    padding-top: calc(12px + env(safe-area-inset-top));
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid var(--accent);
  }

  .avatar-placeholder {
    background: var(--accent);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
  }

  .identity-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .display-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .team {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .jam-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 20px;
    white-space: nowrap;
  }

  .jam-badge--running {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .jam-badge--idle {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .jam-badge--ended {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .btn-logout {
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    min-height: 32px;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-logout:hover {
    border-color: var(--text-muted);
    color: var(--text);
  }

  .dashboard-main {
    flex: 1;
    padding-top: 20px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 20px 16px;
  }

  .loading-hint {
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    padding: 16px;
  }
</style>