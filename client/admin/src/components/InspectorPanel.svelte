<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Participant } from '@shared/types';
  import PanicTab        from './inspector/PanicTab.svelte';
  import SettingsTab     from './inspector/SettingsTab.svelte';
  import ParticipantsTab from './inspector/ParticipantsTab.svelte';

  interface Props {
    me: Participant;
  }

  const { me }: Props = $props();
</script>

<div class="inspector">
  <div class="panel-header">
    <span class="panel-label">Inspecteur</span>
  </div>

  <Tabs.Root value="panic" class="tabs-root">
    <Tabs.List class="tabs-list">
      <Tabs.Trigger value="panic"        class="tab-trigger panic-tab">Panic</Tabs.Trigger>
      <Tabs.Trigger value="participants" class="tab-trigger">Participants</Tabs.Trigger>
      <Tabs.Trigger value="settings"     class="tab-trigger">Paramètres</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="panic"        class="tab-content"><PanicTab /></Tabs.Content>
    <Tabs.Content value="participants" class="tab-content"><ParticipantsTab {me} /></Tabs.Content>
    <Tabs.Content value="settings"     class="tab-content"><SettingsTab /></Tabs.Content>
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

  :global(.tab-trigger:hover)                  { color: var(--text); background: var(--bg-hover); }
  :global(.tab-trigger[data-state="active"])   { color: var(--accent); border-bottom-color: var(--accent); }
  :global(.panic-tab)                          { color: var(--live) !important; opacity: 0.7; }
  :global(.panic-tab[data-state="active"])     { border-bottom-color: var(--live) !important; opacity: 1; }
  :global(.tab-content)                        { flex: 1; overflow-y: auto; }
</style>
