<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id:       string;
    label:    string;
    desc?:    string;
    unit?:    string;
    children: Snippet;
  }

  let { id, label, desc, unit, children }: Props = $props();
</script>

<div class="field-group">
  <div class="field-group__meta">
    <label class="field-group__label" for={id}>{label}</label>
    {#if desc}
      <span class="field-group__desc">{desc}</span>
    {/if}
  </div>

  <div class="field-group__control">
    {@render children()}
    {#if unit}
      <span class="field-group__unit">{unit}</span>
    {/if}
  </div>
</div>

<style>
  .field-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 0;
  }

  .field-group__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .field-group__label {
    font-size: var(--font-size-md);
    color: var(--text);
    white-space: nowrap;
    cursor: default;
  }

  .field-group__desc {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    line-height: 1.4;
  }

  .field-group__control {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .field-group__control :global(input) {
    width: 80px;
    background: var(--bg-input, var(--bg-deep));
    border: 1px solid var(--border-dim);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--font-size-base);
    padding: 3px 6px;
    text-align: right;
    outline: none;
    transition: border-color 0.12s;
  }

  .field-group__control :global(input:focus) {
    border-color: var(--accent);
  }

  .field-group__control :global(input[type="datetime-local"]) {
    width: 140px;
    text-align: left;
  }

  .field-group__unit {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    font-family: var(--font-mono);
    white-space: nowrap;
  }
</style>
