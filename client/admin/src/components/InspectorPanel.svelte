<script lang="ts">
  import { Tabs } from 'bits-ui';
  import TickersTab from "./inspector/TickersTab.svelte";
  import ScheduleTab from "./inspector/ScheduleTab.svelte";
  import SettingsTab from "./inspector/SettingsTab.svelte";
  import PanicTab from "./inspector/PanicTab.svelte";
</script>

<div class="inspector">
  <div class="panel-header">
    <span class="panel-label">Inspecteur</span>
  </div>

  <Tabs.Root value="tickers" class="tabs-root">
    <Tabs.List class="tabs-list">
      <Tabs.Trigger value="tickers"  class="tab-trigger">Tickers</Tabs.Trigger>
      <Tabs.Trigger value="schedule" class="tab-trigger">Schedule</Tabs.Trigger>
      <Tabs.Trigger value="settings" class="tab-trigger">Paramètres</Tabs.Trigger>
      <Tabs.Trigger value="panic"    class="tab-trigger panic-tab">Panic</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="tickers"  class="tab-content"><TickersTab  /></Tabs.Content>
    <Tabs.Content value="schedule" class="tab-content"><ScheduleTab /></Tabs.Content>
    <Tabs.Content value="settings" class="tab-content"><SettingsTab /></Tabs.Content>
    <Tabs.Content value="panic"    class="tab-content"><PanicTab    /></Tabs.Content>
  </Tabs.Root>
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
    overflow: hidden;
  }

  :global(.tabs-root) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  :global(.tabs-list) {
    display: flex;
    border-bottom: 1px solid var(--border-dim);
    background: var(--bg-panel);
    flex-shrink: 0;
  }

  :global(.tab-trigger) {
    flex: 1;
    padding: 7px 6px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  :global(.tab-trigger:hover) { color: var(--text); background: var(--bg-hover); }
  :global(.tab-trigger[data-state="active"]) { color: var(--accent); border-bottom-color: var(--accent); }
  :global(.panic-tab) { color: var(--live) !important; opacity: 0.7; }
  :global(.panic-tab[data-state="active"]) { border-bottom-color: var(--live) !important; opacity: 1; }

  :global(.tab-content) { flex: 1; overflow-y: auto; }
</style>