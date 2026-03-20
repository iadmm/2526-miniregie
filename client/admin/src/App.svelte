<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { api } from './lib/api.ts';
  import type { Participant } from '@shared/types';
  import Login          from './components/Login.svelte';
  import TopBar         from './components/TopBar.svelte';
  import SourcePanel    from './components/SourcePanel.svelte';
  import ProgramMonitor from './components/ProgramMonitor.svelte';
  import InspectorPanel from './components/InspectorPanel.svelte';
  import EditTimeline   from './components/EditTimeline.svelte';

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

    <div class="body">
      <PaneGroup direction="vertical" class="pane-group-v">
        <!-- Main row: Source / Monitor / Inspector -->
        <Pane defaultSize={78} minSize={50} class="pane-main-row">
          <PaneGroup direction="horizontal" class="pane-group-h">
            <Pane defaultSize={22} minSize={14} class="pane-cell">
              <SourcePanel />
            </Pane>
            <PaneResizer class="resizer resizer-v" />
            <Pane defaultSize={44} minSize={30} class="pane-cell">
              <ProgramMonitor />
            </Pane>
            <PaneResizer class="resizer resizer-v" />
            <Pane defaultSize={34} minSize={18} class="pane-cell">
              <InspectorPanel {me} />
            </Pane>
          </PaneGroup>
        </Pane>

        <PaneResizer class="resizer resizer-h" />

        <!-- Bottom: timeline -->
        <Pane defaultSize={22} minSize={12} class="pane-cell">
          <EditTimeline />
        </Pane>
      </PaneGroup>
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
    overflow: hidden;
    min-height: 0;
  }

  :global(.pane-group-v),
  :global(.pane-group-h) {
    width: 100%;
    height: 100%;
  }

  :global(.pane-main-row) {
    min-height: 0;
  }

  :global(.pane-cell) {
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }

  /* Resizer handles */
  :global(.resizer) {
    flex-shrink: 0;
    background: var(--border-dim);
    transition: background 0.15s;
  }

  :global(.resizer:hover),
  :global(.resizer[data-active]) {
    background: var(--accent);
  }

  :global(.resizer-v) {
    width: 3px;
    cursor: col-resize;
  }

  :global(.resizer-h) {
    height: 3px;
    cursor: row-resize;
  }
</style>
