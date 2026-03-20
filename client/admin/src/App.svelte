<script lang="ts">
  import { onMount } from 'svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { auth, checkSession } from './lib/auth.svelte.ts';
  import LoginScreen from './components/LoginScreen.svelte';
  import TopBar from './components/TopBar.svelte';
  import ProgramMonitor from './components/ProgramMonitor.svelte';
  import QueueTabs from './components/QueueTabs.svelte';
  import RightTabs from './components/RightTabs.svelte';
  import SchedulePanel from './components/SchedulePanel.svelte';
  import JamControlPanel from './components/JamControlPanel.svelte';

  onMount(checkSession);
</script>

{#if auth.status === 'checking'}
  <div class="checking">…</div>
{:else if auth.status === 'login'}
  <LoginScreen />
{:else}
  <TopBar />
  <main class="shell">
    <PaneGroup direction="vertical" autoSaveId="admin-rows">
      <Pane defaultSize={60} minSize={20}>
        <PaneGroup direction="horizontal" autoSaveId="admin-row1">
          <Pane defaultSize={33} minSize={10}>
            <div class="monitor-col">
              <ProgramMonitor />
              <JamControlPanel />
            </div>
          </Pane>
          <PaneResizer />
          <Pane defaultSize={34} minSize={10}>
            <QueueTabs />
          </Pane>
          <PaneResizer />
          <Pane defaultSize={33} minSize={10}>
            <RightTabs />
          </Pane>
        </PaneGroup>
      </Pane>

      <PaneResizer />

      <Pane defaultSize={40} minSize={15}>
        <PaneGroup direction="horizontal" autoSaveId="admin-row2">
          <Pane defaultSize={50} minSize={15}>
            <SchedulePanel />
          </Pane>
          <PaneResizer />
          <Pane defaultSize={50} minSize={15}>
            <div class="placeholder-panel">
              <div class="panel-header"><span class="panel-label">Panel 5</span></div>
              <div class="panel-body"></div>
            </div>
          </Pane>
        </PaneGroup>
      </Pane>
    </PaneGroup>
  </main>
{/if}

<style>
  .checking {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--bg-deep);
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .shell {
    height: calc(100vh - 36px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(.shell > [data-pane-group]) {
    flex: 1;
    height: 100%;
  }

  :global([data-pane] > [data-pane-group]) {
    width: 100%;
    height: 100%;
  }

  .monitor-col {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .placeholder-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  :global([data-pane-resizer][data-direction="horizontal"]) {
    width: 3px;
    cursor: col-resize;
    background: var(--border-dim);
    transition: background 0.15s;
    flex-shrink: 0;
  }

  :global([data-pane-resizer][data-direction="vertical"]) {
    height: 3px;
    cursor: row-resize;
    background: var(--border-dim);
    transition: background 0.15s;
    flex-shrink: 0;
  }

  :global([data-pane-resizer]:hover),
  :global([data-pane-resizer][data-active]) {
    background: var(--accent);
  }
</style>
