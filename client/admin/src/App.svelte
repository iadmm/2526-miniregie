<script lang="ts">
  import { Tabs } from 'bits-ui';
  import { api } from './lib/api.ts';
  import type { Participant } from '@shared/types';
  import Login          from './components/Login.svelte';
  import TopBar         from './components/TopBar.svelte';
  import SourcePanel    from './components/SourcePanel.svelte';
  import EditTimeline   from './components/EditTimeline.svelte';
  import InspectorPanel from './components/InspectorPanel.svelte';
  import OnAirPanel    from './components/OnAirPanel.svelte';

  type View = 'loading' | 'login' | 'dashboard';

  let view      = $state<View>('loading');
  let me        = $state<Participant | null>(null);
  let authError = $state<string | null>(null);

  $effect(() => {
    api.auth
      .me()
      .then(({ participant }) => {
        if (participant.role !== 'admin') {
          authError = 'Accès réservé aux admins.';
          view = 'login';
        } else {
          me   = participant;
          view = 'dashboard';
        }
      })
      .catch(() => { view = 'login'; });
  });

  function handleLogin(participant: Participant): void {
    me        = participant;
    authError = null;
    view      = 'dashboard';
  }

  function handleLogout(): void {
    me   = null;
    view = 'login';
  }
</script>

{#if view === 'loading'}
  <div class="full-center">
    <span class="loading-text">Vérification de la session…</span>
  </div>

{:else if view === 'login'}
  <Login {authError} onLogin={handleLogin} />

{:else if view === 'dashboard' && me}
  <div class="workspace">
    <TopBar {me} onLogout={handleLogout} />

    <OnAirPanel />

    <div class="body">
      <!-- Main zone: Queue / Timeline tabs -->
      <Tabs.Root value="queue" class="main-tabs">
        <Tabs.List class="main-tab-list">
          <Tabs.Trigger value="queue"    class="main-tab-trigger">Queue</Tabs.Trigger>
          <Tabs.Trigger value="timeline" class="main-tab-trigger">Timeline</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="queue"    class="main-tab-content"><SourcePanel /></Tabs.Content>
        <Tabs.Content value="timeline" class="main-tab-content"><EditTimeline /></Tabs.Content>
      </Tabs.Root>

      <!-- Side panel -->
      <aside class="side-panel">
        <InspectorPanel {me} />
      </aside>
    </div>
  </div>
{/if}

<style>
  .full-center {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--bg);
  }

  .loading-text {
    font-size: 13px;
    color: var(--text-muted);
  }

  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg);
  }

  .body {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  :global(.main-tabs) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  :global(.main-tab-list) {
    display: flex;
    border-bottom: 1px solid var(--border-dim);
    background: var(--bg-panel);
    flex-shrink: 0;
  }

  :global(.main-tab-trigger) {
    padding: 8px 20px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  :global(.main-tab-trigger:hover)                 { color: var(--text); background: var(--bg-hover); }
  :global(.main-tab-trigger[data-state="active"])  { color: var(--accent); border-bottom-color: var(--accent); }

  :global(.main-tab-content) {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .side-panel {
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--border-dim);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
