<script lang="ts">
  import { api } from '../../lib/api.ts';
  import type {
    MediaItem,
    PhotoContent, GifContent, NoteContent, ClipContent,
    TickerContent, YoutubeContent, LinkContent, InterviewContent,
  } from '@shared/types';
  import DropdownMenu from '../ui/DropdownMenu.svelte';

  interface Props {
    item: MediaItem;
    activeIds: string[];
    onMutate: () => void;
    // Drag-and-drop
    isDragging?:    boolean;
    dropIndicator?: 'above' | 'below' | null;
    onDragStart?:   (id: string) => void;
    onDragOver?:    (id: string, before: boolean) => void;
    onDrop?:        () => void;
    onDragEnd?:     () => void;
  }
  const { item, activeIds, onMutate, isDragging, dropIndicator, onDragStart, onDragOver, onDrop, onDragEnd }: Props = $props();

  // ─── Derived state ────────────────────────────────────────────────────────────

  const isOnAir = $derived(activeIds.includes(item.id));

  // ─── Type metadata ────────────────────────────────────────────────────────────

  const TYPE_LABEL: Record<string, string> = {
    photo: 'photo', gif: 'gif', note: 'note', clip: 'clip',
    ticker: 'ticker', youtube: 'yt', link: 'link', interview: 'intv',
  };

  const TYPE_COLOR: Record<string, string> = {
    photo:     'var(--accent)',
    gif:       '#a855f7',
    note:      'var(--warning)',
    clip:      'var(--ready)',
    ticker:    'var(--accent-dim)',
    youtube:   'var(--live)',
    link:      'var(--text-muted)',
    interview: '#06b6d4',
  };

  function timeAgo(ts: number): string {
    const m = Math.floor((Date.now() - ts) / 60_000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  }

  // ─── Preview ──────────────────────────────────────────────────────────────────

  type Preview =
    | { kind: 'img';  url: string; caption: string }
    | { kind: 'text'; text: string }
    | { kind: 'meta'; label: string; sub: string };

  function getPreview(it: MediaItem): Preview {
    const c = it.content;
    switch (it.type) {
      case 'photo':   { const p = c as PhotoContent;   return { kind: 'img',  url: p.url, caption: p.caption ?? '' }; }
      case 'gif':     { const g = c as GifContent;     return { kind: 'img',  url: g.url, caption: g.caption ?? '' }; }
      case 'youtube': { const y = c as YoutubeContent; return { kind: 'img',  url: y.thumbnail, caption: y.title }; }
      case 'link': {
        const l = c as LinkContent;
        return l.thumbnail
          ? { kind: 'img',  url: l.thumbnail, caption: l.title ?? '' }
          : { kind: 'text', text: l.title ?? l.url };
      }
      case 'note':   return { kind: 'text', text: (c as NoteContent).text };
      case 'ticker': return { kind: 'text', text: (c as TickerContent).text };
      case 'clip': {
        const cl = c as ClipContent;
        return { kind: 'meta', label: `${Math.round(cl.duration)}s`, sub: cl.caption ?? '' };
      }
      case 'interview': {
        const iv = c as InterviewContent;
        return { kind: 'meta', label: iv.subject.displayName, sub: `${iv.segments.length} seg.` };
      }
      default: return { kind: 'text', text: '' };
    }
  }

  // ─── Editable field ───────────────────────────────────────────────────────────

  type Editable = { field: 'text' | 'caption'; value: string } | null;

  function getEditable(it: MediaItem): Editable {
    const c = it.content;
    if (it.type === 'note')   return { field: 'text', value: (c as NoteContent).text };
    if (it.type === 'ticker') return { field: 'text', value: (c as TickerContent).text };
    if (['photo', 'gif', 'clip', 'youtube', 'link'].includes(it.type))
      return { field: 'caption', value: (c as { caption?: string | null }).caption ?? '' };
    return null;
  }

  const preview  = $derived(getPreview(item));
  const editable = $derived(getEditable(item));

  // ─── Action state ─────────────────────────────────────────────────────────────

  let editing       = $state(false);
  let editValue     = $state('');
  let saving        = $state(false);
  let pendingDelete = $state(false);
  let deleteTimer: ReturnType<typeof setTimeout> | null = null;

  function onMenuClose() {
    // Reset delete confirmation when menu is dismissed
    if (deleteTimer) clearTimeout(deleteTimer);
    pendingDelete = false;
  }

  function openEdit(close: () => void) {
    editValue = editable?.value ?? '';
    editing = true;
    close();
  }

  function cancelEdit() { editing = false; }

  async function saveEdit() {
    if (!editable || saving) return;
    saving = true;
    try {
      await api.items.update(item.id, { [editable.field]: editValue });
      onMutate();
      editing = false;
    } finally {
      saving = false;
    }
  }

  function handleDelete(close: () => void) {
    if (pendingDelete) {
      if (deleteTimer) clearTimeout(deleteTimer);
      pendingDelete = false;
      close();
      api.items.delete(item.id).then(onMutate);
    } else {
      pendingDelete = true;
      deleteTimer = setTimeout(() => { pendingDelete = false; }, 3000);
    }
  }
</script>

<article
  class="queue-item"
  class:queue-item--on-air={isOnAir}
  class:queue-item--dragging={isDragging}
  class:queue-item--drop-above={dropIndicator === 'above'}
  class:queue-item--drop-below={dropIndicator === 'below'}
  draggable="true"
  ondragstart={(e) => { e.dataTransfer?.setData('text/plain', item.id); onDragStart?.(item.id); }}
  ondragover={(e) => { e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onDragOver?.(item.id, e.clientY < r.top + r.height / 2); }}
  ondrop={(e) => { e.preventDefault(); onDrop?.(); }}
  ondragend={onDragEnd}
>
  <!-- ─── Header ─────────────────────────────────────────────────────────────── -->
  <div class="queue-item__header">

    <span class="queue-item__grip" aria-hidden="true"></span>

    <span
      class="queue-item__type"
      style="color:{TYPE_COLOR[item.type] ?? 'var(--text-muted)'}"
    >{TYPE_LABEL[item.type] ?? item.type}</span>

    <span class="queue-item__author">{item.author.displayName}</span>

    <div class="queue-item__header-right">
      {#if isOnAir}
        <span class="queue-item__on-air">on air</span>
      {/if}

      <DropdownMenu id={item.id} onclose={onMenuClose}>
        {#snippet trigger()}⋮{/snippet}

        {#snippet menu(close)}
          {#if editable}
            <button
              class="queue-item__menu-item"
              onclick={() => openEdit(close)}
              role="menuitem"
            >
              Edit content
            </button>
          {/if}

          <hr class="queue-item__menu-sep" />

          <button
            class="queue-item__menu-item queue-item__menu-item--danger"
            class:queue-item__menu-item--confirm={pendingDelete}
            onclick={() => handleDelete(close)}
            role="menuitem"
          >
            {pendingDelete ? 'Confirm delete?' : 'Delete'}
          </button>
        {/snippet}
      </DropdownMenu>
    </div>
  </div>

  <!-- ─── Body ──────────────────────────────────────────────────────────────── -->
  <div class="queue-item__body">
    {#if preview.kind === 'img'}
      <img class="queue-item__thumb" src={preview.url} alt="" />
      <div class="queue-item__content">
        {#if preview.caption}
          <span class="queue-item__caption">{preview.caption}</span>
        {/if}
        <span class="queue-item__footer">
          {item.author.team} · {timeAgo(item.submittedAt)}
        </span>
      </div>

    {:else if preview.kind === 'text'}
      <div class="queue-item__content">
        <span class="queue-item__text">{preview.text}</span>
        <span class="queue-item__footer">
          {item.author.team} · {timeAgo(item.submittedAt)}
        </span>
      </div>

    {:else}
      <div class="queue-item__content">
        <span class="queue-item__meta-label">{preview.label}</span>
        {#if preview.sub}<span class="queue-item__caption">{preview.sub}</span>{/if}
        <span class="queue-item__footer">
          {item.author.team} · {timeAgo(item.submittedAt)}
        </span>
      </div>
    {/if}
  </div>

  <!-- ─── Inline edit ────────────────────────────────────────────────────────── -->
  {#if editing}
    <div class="queue-item__edit">
      <textarea
        class="queue-item__edit-input"
        bind:value={editValue}
        rows={2}
      ></textarea>
      <div class="queue-item__edit-actions">
        <button class="btn btn-primary btn-xs" onclick={saveEdit} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
        <button class="btn btn-ghost btn-xs" onclick={cancelEdit}>Cancel</button>
      </div>
    </div>
  {/if}
</article>

<style>
  /* ─── Block ──────────────────────────────────────────────────────────────────── */

  .queue-item {
    border-bottom: 1px solid var(--border-dim);
    border-left: 3px solid transparent;
    background: var(--bg-panel);
    transition: background 0.1s, border-left-color 0.15s;
  }

  .queue-item:hover       { background: var(--bg-hover); }
  .queue-item--on-air     { border-left-color: var(--live); }
  .queue-item--dragging   { opacity: 0.35; }

  /* Drop insertion indicators */
  .queue-item--drop-above { box-shadow: inset 0 2px 0 var(--accent); }
  .queue-item--drop-below { box-shadow: inset 0 -2px 0 var(--accent); }

  /* ─── Header ─────────────────────────────────────────────────────────────────── */

  .queue-item__header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 6px 5px 6px;
  }

  /* Drag grip — 6-dot CSS grid */
  .queue-item__grip {
    width: 8px;
    height: 14px;
    flex-shrink: 0;
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
    background-image:
      radial-gradient(circle, var(--text-dim) 1px, transparent 1px),
      radial-gradient(circle, var(--text-dim) 1px, transparent 1px);
    background-size: 3px 5px;
    background-position: 0 0, 4px 0;
    background-repeat: repeat-y;
  }

  .queue-item:hover .queue-item__grip { opacity: 1; }
  .queue-item--dragging .queue-item__grip { cursor: grabbing; opacity: 1; }

  .queue-item__type {
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .queue-item__author {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .queue-item__header-right {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .queue-item__on-air {
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--live);
    background: var(--live-glow);
    padding: 1px 5px;
    border-radius: var(--radius);
  }

  /* ─── Body ───────────────────────────────────────────────────────────────────── */

  .queue-item__body {
    display: flex;
    gap: 8px;
    padding: 0 8px 8px;
    align-items: flex-start;
  }

  .queue-item__thumb {
    width: 64px;
    height: 40px;
    object-fit: cover;
    border-radius: var(--radius);
    flex-shrink: 0;
    background: var(--bg-surface);
  }

  .queue-item__content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
    padding-top: 2px;
  }

  .queue-item__caption {
    font-size: var(--font-size-base);
    color: var(--text); /* primary content — 11.6:1 */
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .queue-item__text {
    font-size: var(--font-size-base);
    font-style: italic;
    color: var(--text); /* primary content — italic already signals type */
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .queue-item__meta-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-base);
    color: var(--text);
  }

  .queue-item__footer {
    font-size: var(--font-size-sm);
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: auto;
  }

  /* ─── Dropdown menu items ────────────────────────────────────────────────────── */

  .queue-item__menu-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: var(--font-size-md);
    font-weight: 400;
    text-align: left;
    cursor: pointer;
    transition: background 0.08s, color 0.08s;
  }

  .queue-item__menu-item:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .queue-item__menu-item--active { color: var(--accent); }
  .queue-item__menu-item--active:hover { color: var(--accent); }

  .queue-item__menu-item--danger { color: var(--text-muted); }
  .queue-item__menu-item--danger:hover { color: var(--danger); background: rgba(229,57,53,0.08); }
  .queue-item__menu-item--confirm { color: var(--danger); }
  .queue-item__menu-item--confirm:hover { background: rgba(229,57,53,0.12); }

  .queue-item__menu-sep {
    border: none;
    border-top: 1px solid var(--border-dim);
    margin: 3px 0;
  }

  /* ─── Inline edit ────────────────────────────────────────────────────────────── */

  .queue-item__edit {
    padding: 6px 8px 8px;
    border-top: 1px solid var(--border-dim);
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: var(--bg-surface);
  }

  .queue-item__edit-input {
    resize: vertical;
    min-height: 48px;
    font-size: var(--font-size-base);
  }

  .queue-item__edit-actions {
    display: flex;
    gap: 5px;
  }
</style>
