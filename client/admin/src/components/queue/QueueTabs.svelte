<script lang="ts">
  import QueuePanel from './QueuePanel.svelte';
  import PlayedPanel from './PlayedPanel.svelte';

  let active = $state<'queue' | 'played'>('queue');
</script>

<div class="queue-tabs">
  <div class="queue-tabs__bar">
    <button
      class="queue-tabs__tab"
      class:queue-tabs__tab--active={active === 'queue'}
      onclick={() => (active = 'queue')}
    >Queue</button>
    <button
      class="queue-tabs__tab"
      class:queue-tabs__tab--active={active === 'played'}
      onclick={() => (active = 'played')}
    >Played</button>
  </div>

  <div class="queue-tabs__content">
    <div class="queue-tabs__pane" class:queue-tabs__pane--visible={active === 'queue'}>
      <QueuePanel />
    </div>
    <div class="queue-tabs__pane" class:queue-tabs__pane--visible={active === 'played'}>
      <PlayedPanel />
    </div>
  </div>
</div>

<style>
  .queue-tabs {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel);
  }

  .queue-tabs__bar {
    display: flex;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .queue-tabs__tab {
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

  .queue-tabs__tab:hover {
    color: var(--text-muted);
  }

  .queue-tabs__tab--active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .queue-tabs__content {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .queue-tabs__pane {
    position: absolute;
    inset: 0;
    display: none;
  }

  .queue-tabs__pane--visible {
    display: flex;
    flex-direction: column;
  }

  /* Hide the individual panel headers — tabs serve that role */
  .queue-tabs__pane :global(.panel-header) {
    display: none;
  }
</style>
