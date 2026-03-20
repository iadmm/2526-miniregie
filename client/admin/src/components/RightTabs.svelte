<script lang="ts">
  import PanicPanel from './PanicPanel.svelte';
  import ParticipantsPanel from './ParticipantsPanel.svelte';

  let active = $state<'panic' | 'participants'>('panic');
</script>

<div class="right-tabs">
  <div class="right-tabs__bar">
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
  </div>

  <div class="right-tabs__content">
    <div class="right-tabs__pane" class:right-tabs__pane--visible={active === 'panic'}>
      <PanicPanel />
    </div>
    <div class="right-tabs__pane" class:right-tabs__pane--visible={active === 'participants'}>
      <ParticipantsPanel />
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
    font-size: 11px;
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

  /* PanicPanel has its own panel-header — hide it inside tabs */
  .right-tabs__pane :global(.panel-header) {
    display: none;
  }
</style>
