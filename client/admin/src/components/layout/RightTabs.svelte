<script lang="ts">
  import PanicPanel from '../broadcast/PanicPanel.svelte';
  import ParticipantsPanel from '../participants/ParticipantsPanel.svelte';
  import OnAirPanel from '../queue/OnAirPanel.svelte';
  import SettingsTab from '../system/SettingsTab.svelte';

  let active = $state<'onair' | 'panic' | 'participants' | 'settings'>('onair');
</script>

<div class="right-tabs">
  <div class="right-tabs__bar">
    <button
      class="right-tabs__tab"
      class:right-tabs__tab--active={active === 'onair'}
      onclick={() => (active = 'onair')}
    >On Air</button>
    <button
      class="right-tabs__tab"
      class:right-tabs__tab--active={active === 'panic'}
      onclick={() => (active = 'panic')}
    >Panic</button>
    <button
      class="right-tabs__tab"
      class:right-tabs__tab--active={active === 'participants'}
      onclick={() => (active = 'participants')}
    >Participants</button>
    <button
      class="right-tabs__tab"
      class:right-tabs__tab--active={active === 'settings'}
      onclick={() => (active = 'settings')}
    >Settings</button>
  </div>

  <div class="right-tabs__content">
    <div class="right-tabs__pane" class:right-tabs__pane--visible={active === 'onair'}>
      <OnAirPanel />
    </div>
    <div class="right-tabs__pane" class:right-tabs__pane--visible={active === 'panic'}>
      <PanicPanel />
    </div>
    <div class="right-tabs__pane" class:right-tabs__pane--visible={active === 'participants'}>
      <ParticipantsPanel />
    </div>
    <div class="right-tabs__pane right-tabs__pane--scroll" class:right-tabs__pane--visible={active === 'settings'}>
      <SettingsTab />
    </div>
  </div>
</div>

<style>
  .right-tabs {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .right-tabs__bar {
    display: flex;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .right-tabs__tab {
    padding: 0 14px;
    height: 36px;
    font-size: var(--font-size-base);
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    transition: color 0.12s;
  }

  .right-tabs__tab:hover { color: var(--text-muted); }

  .right-tabs__tab--active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .right-tabs__content {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .right-tabs__pane {
    position: absolute;
    inset: 0;
    display: none;
  }

  .right-tabs__pane--visible {
    display: flex;
    flex-direction: column;
  }

  .right-tabs__pane--scroll {
    overflow-y: auto;
  }

  /* PanicPanel has its own panel-header — hide it inside tabs */
  .right-tabs__pane :global(.panel-header) {
    display: none;
  }
</style>
