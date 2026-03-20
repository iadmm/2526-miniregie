<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import ProgramMonitor from "./components/ProgramMonitor.svelte";
</script>

<!-- TopBar -->
<header class="topbar">
  <span class="topbar-logo">MiniRégie</span>
  <span class="topbar-status text-muted">Admin</span>
</header>

<!-- Resizable shell -->
<main class="shell">
  <PaneGroup direction="vertical" autoSaveId="admin-rows">
    <!-- Row 1: 3 columns -->
    <Pane defaultSize={60} minSize={20}>
      <PaneGroup direction="horizontal" autoSaveId="admin-row1">
        <Pane defaultSize={33} minSize={10}>
          <ProgramMonitor />
        </Pane>
        <PaneResizer />
        <Pane defaultSize={34} minSize={10}>
          <div class="placeholder-panel">
            <div class="panel-header"><span class="panel-label">Panel 2</span></div>
            <div class="panel-body"></div>
          </div>
        </Pane>
        <PaneResizer />
        <Pane defaultSize={33} minSize={10}>
          <div class="placeholder-panel">
            <div class="panel-header"><span class="panel-label">Panel 3</span></div>
            <div class="panel-body"></div>
          </div>
        </Pane>
      </PaneGroup>
    </Pane>

    <PaneResizer />

    <!-- Row 2: 2 columns -->
    <Pane defaultSize={40} minSize={15}>
      <PaneGroup direction="horizontal" autoSaveId="admin-row2">
        <Pane defaultSize={50} minSize={15}>
          <div class="placeholder-panel">
            <div class="panel-header"><span class="panel-label">Panel 4</span></div>
            <div class="panel-body"></div>
          </div>
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

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 36px;
    padding: 0 12px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .topbar-logo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .shell {
    height: calc(100vh - 36px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* paneforge root fills the shell */
  :global(.shell > [data-pane-group]) {
    flex: 1;
    height: 100%;
  }

  /* nested pane groups fill their pane */
  :global([data-pane] > [data-pane-group]) {
    width: 100%;
    height: 100%;
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
