<script lang="ts">
  import { api } from './lib/api.ts';
  import type { Participant } from '@shared/types';
  import Login from './components/Login.svelte';
  import Header from './components/Header.svelte';
  import ItemsPanel from './components/ItemsPanel.svelte';
  import ParticipantsPanel from './components/ParticipantsPanel.svelte';
  import StatePanel from './components/StatePanel.svelte';

  // ─── Auth state ──────────────────────────────────────────────────────────────

  type View = 'loading' | 'login' | 'dashboard';

  let view = $state<View>('loading');
  let me = $state<Participant | null>(null);
  let authError = $state<string | null>(null);

  // ─── Tab state ────────────────────────────────────────────────────────────────

  type Tab = 'items' | 'participants' | 'state';
  let activeTab = $state<Tab>('items');

  // ─── Check auth on mount ─────────────────────────────────────────────────────

  $effect(() => {
    api.auth
      .me()
      .then(({ participant }) => {
        if (participant.role !== 'admin') {
          authError = 'Accès réservé aux admins.';
          view = 'login';
        } else {
          me = participant;
          view = 'dashboard';
        }
      })
      .catch(() => {
        view = 'login';
      });
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleLogin(participant: Participant): void {
    me = participant;
    authError = null;
    view = 'dashboard';
  }

  function handleLogout(): void {
    me = null;
    view = 'login';
  }
</script>

{#if view === 'loading'}
  <div class="full-center">
    <div class="loading">Vérification de la session…</div>
  </div>

{:else if view === 'login'}
  <Login {authError} onLogin={handleLogin} />

{:else if view === 'dashboard' && me}
  <div class="dashboard">
    <Header {me} onLogout={handleLogout} />

    <nav class="tabs">
      <button
        class="tab-btn"
        class:active={activeTab === 'items'}
        onclick={() => { activeTab = 'items'; }}
      >
        Items
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'participants'}
        onclick={() => { activeTab = 'participants'; }}
      >
        Participants
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'state'}
        onclick={() => { activeTab = 'state'; }}
      >
        État
      </button>
    </nav>

    <main class="tab-content">
      {#if activeTab === 'items'}
        <ItemsPanel />
      {:else if activeTab === 'participants'}
        <ParticipantsPanel />
      {:else}
        <StatePanel />
      {/if}
    </main>
  </div>
{/if}

<style>
  .full-center {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }

  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
    padding: 0 20px;
  }

  .tab-btn {
    background: transparent;
    color: var(--text-muted);
    border: none;
    border-radius: 0;
    padding: 12px 20px;
    font-size: 13px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    margin-bottom: -1px;
  }

  .tab-btn:hover {
    color: var(--text);
    background: transparent;
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg);
  }
</style>