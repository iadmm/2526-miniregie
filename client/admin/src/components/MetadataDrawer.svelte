<script lang="ts">
  import type { ScoredMediaItem } from '@shared/types';

  interface Props {
    item: ScoredMediaItem;
    onClose: () => void;
    onSave:  (id: string, patch: { priority?: number; caption?: string; text?: string }) => Promise<void>;
  }

  const { item, onClose, onSave }: Props = $props();

  // Determine editable text field based on content type
  function getEditableText(i: ScoredMediaItem): { key: 'text' | 'caption' | null; label: string; value: string } {
    const c = i.content as Record<string, unknown>;
    if ('text' in c && typeof c.text === 'string')       return { key: 'text',    label: 'Text',    value: c.text };
    if ('caption' in c && typeof c.caption === 'string') return { key: 'caption', label: 'Caption', value: c.caption ?? '' };
    if ('caption' in c)                                   return { key: 'caption', label: 'Caption', value: '' };
    return { key: null, label: '', value: '' };
  }

  function getDuration(i: ScoredMediaItem): number | null {
    const c = i.content as Record<string, unknown>;
    if (typeof c.duration === 'number') return c.duration;
    return null;
  }

  const editable    = $derived(getEditableText(item));
  const duration    = $derived(getDuration(item));

  let priority  = $state(item.priority);
  let textValue = $state(editable.value);
  let saving    = $state(false);
  let error     = $state<string | null>(null);

  async function handleSave(): Promise<void> {
    saving = true;
    error  = null;
    try {
      const patch: { priority?: number; caption?: string; text?: string } = {};
      if (priority !== item.priority) patch.priority = priority;
      if (editable.key && textValue !== editable.value) {
        patch[editable.key] = textValue;
      }
      if (Object.keys(patch).length > 0) {
        await onSave(item.id, patch);
      } else {
        onClose();
      }
    } catch {
      error = 'Save failed';
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div class="backdrop" onclick={onClose} aria-hidden="true"></div>

<!-- Drawer -->
<div class="drawer" role="dialog" aria-label="Edit item metadata">
  <div class="drawer-header">
    <span class="drawer-title">Edit — <span class="type-label">{item.type}</span></span>
    <button class="close-btn" onclick={onClose}>×</button>
  </div>

  <div class="drawer-body">
    <!-- Author info (read-only) -->
    <div class="field-group">
      <span class="field-label">Author</span>
      <span class="field-value">{item.author.displayName} / {item.author.team || '—'}</span>
    </div>

    <!-- Score info (read-only) -->
    <div class="field-group">
      <span class="field-label">Score</span>
      <span class="field-value mono">{item.score} (shown:{item.displayedCount} skip:{item.skippedCount})</span>
    </div>

    {#if duration !== null}
      <div class="field-group">
        <span class="field-label">Duration</span>
        <span class="field-value mono">{(duration / 1000).toFixed(1)}s</span>
      </div>
    {/if}

    <!-- Priority -->
    <div class="field-group field-group-input">
      <label class="field-label" for="meta-priority">Priority</label>
      <input
        id="meta-priority"
        type="number"
        min="0"
        max="999"
        bind:value={priority}
        class="field-input"
      />
    </div>

    <!-- Caption / Text -->
    {#if editable.key !== null}
      <div class="field-group field-group-input field-group-col">
        <label class="field-label" for="meta-text">{editable.label}</label>
        <textarea
          id="meta-text"
          rows="3"
          bind:value={textValue}
          class="field-textarea"
        ></textarea>
      </div>
    {/if}

    {#if error}
      <div class="error-msg">{error}</div>
    {/if}
  </div>

  <div class="drawer-footer">
    <button class="btn btn-ghost btn-sm" onclick={onClose} disabled={saving}>Cancel</button>
    <button class="btn btn-primary btn-sm" onclick={handleSave} disabled={saving}>
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .drawer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    max-height: 55%;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .type-label {
    color: var(--accent);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    padding: 0 4px;
    cursor: pointer;
    line-height: 1;
  }
  .close-btn:hover { color: var(--text); }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-group-col {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .field-group-input label { flex-shrink: 0; }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    min-width: 60px;
  }

  .field-value {
    font-size: 11px;
    color: var(--text-muted);
  }

  .mono { font-family: var(--font-mono); }

  .field-input {
    width: 80px;
    font-size: 12px;
    padding: 4px 6px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
  }
  .field-input:focus { border-color: var(--accent); outline: none; }

  .field-textarea {
    width: 100%;
    font-size: 12px;
    padding: 5px 7px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    resize: vertical;
    font-family: var(--font);
    line-height: 1.4;
  }
  .field-textarea:focus { border-color: var(--accent); outline: none; }

  .drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-dim);
    flex-shrink: 0;
  }
</style>
