<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    trigger: Snippet;
    menu: Snippet<[() => void]>;
    onclose?: () => void;
  }
  const { id, trigger, menu, onclose }: Props = $props();

  // CSS anchor-name must be a <dashed-ident>: "--dm-{id}"
  const anchorName = $derived(`--dm-${id}`);
  const popoverId  = $derived(`dm-${id}`);

  let panelEl = $state<HTMLDivElement | undefined>(undefined);

  function close() {
    panelEl?.hidePopover();
  }

  function onToggle(e: Event) {
    if ((e as ToggleEvent).newState === 'closed') onclose?.();
  }
</script>

<div class="dropdown-menu">
  <button
    class="dropdown-menu__trigger"
    style="anchor-name: {anchorName}"
    popovertarget={popoverId}
    aria-haspopup="menu"
    title="Actions"
  >
    {@render trigger()}
  </button>

  <div
    bind:this={panelEl}
    id={popoverId}
    class="dropdown-menu__panel"
    popover="auto"
    style="position-anchor: {anchorName}"
    role="menu"
    ontoggle={onToggle}
  >
    {@render menu(close)}
  </div>
</div>

<style>
  .dropdown-menu {
    display: inline-flex;
    align-items: center;
  }

  /* ─── Trigger ────────────────────────────────────────────────────────────────── */

  .dropdown-menu__trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s, background 0.1s;
  }

  .dropdown-menu__trigger:hover {
    color: var(--text-muted);
    background: var(--bg-surface);
    border-color: var(--border-dim);
  }

  /* ─── Panel ──────────────────────────────────────────────────────────────────── */

  .dropdown-menu__panel {
    /* Reset popover UA defaults */
    position: fixed;
    inset: unset;
    margin: 0;
    padding: 4px;
    border: none;

    /* CSS anchor positioning — aligns panel bottom-right under trigger */
    top: anchor(bottom);
    right: anchor(right);
    margin-top: 4px;

    /* Position fallback: flip above if not enough space */
    position-try-fallbacks: flip-block;

    /* Visual */
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    min-width: 160px;
    z-index: 100;

    /* Entry animation */
    opacity: 0;
    translate: 0 -4px;
    transition:
      opacity 0.1s ease,
      translate 0.1s ease,
      display 0.1s allow-discrete,
      overlay 0.1s allow-discrete;
  }

  .dropdown-menu__panel:popover-open {
    opacity: 1;
    translate: 0 0;
  }

  @starting-style {
    .dropdown-menu__panel:popover-open {
      opacity: 0;
      translate: 0 -4px;
    }
  }
</style>
