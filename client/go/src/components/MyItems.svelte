<script lang="ts">
  import type { MediaItem } from '@shared/types.js';

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    items: MediaItem[];
  }
  const { items }: Props = $props();

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function typeIcon(type: MediaItem['type']): string {
    switch (type) {
      case 'photo':     return '📸';
      case 'gif':       return '🎞️';
      case 'note':      return '📝';
      case 'clip':      return '🎥';
      case 'link':      return '🔗';
      case 'youtube':   return '▶️';
      case 'interview': return '🎤';
      case 'ticker':    return '📡';
    }
  }

  function statusBadge(status: MediaItem['status']): { label: string; icon: string; cls: string } {
    switch (status) {
      case 'pending': return { label: 'En attente',  icon: '⏳', cls: 'pending' };
      case 'ready':   return { label: 'Prêt',        icon: '✅', cls: 'ready' };
      case 'evicted': return { label: 'Retiré',      icon: '❌', cls: 'evicted' };
    }
  }

  function contentPreview(item: MediaItem): string {
    const c = item.content;
    switch (item.type) {
      case 'note':      return (c as { text: string }).text.slice(0, 80);
      case 'link':      return (c as { url: string }).url;
      case 'youtube':   return (c as { url: string }).url;
      case 'photo':
      case 'gif':
      case 'clip': {
        const withUrl = c as { url: string; caption?: string | null };
        if (withUrl.url) {
          // Show filename from URL path
          const parts = withUrl.url.split('/');
          return parts[parts.length - 1] ?? withUrl.url;
        }
        return '';
      }
      case 'ticker':    return (c as { text: string }).text;
      case 'interview': return 'Interview';
    }
  }

  /**
   * Returns a relative time string in French.
   * e.g. "il y a 5 min", "il y a 2h"
   */
  function relativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60)  return 'à l\'instant';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)  return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `il y a ${diffD}j`;
  }
</script>

<section class="my-items">
  <h2 class="section-title">Mes soumissions</h2>

  {#if items.length === 0}
    <p class="empty">Aucune soumission pour l'instant.</p>
  {:else}
    <ul class="items-list">
      {#each items as item (item.id)}
        {@const badge = statusBadge(item.status)}
        <li class="item-row">
          <span class="type-icon" title={item.type}>{typeIcon(item.type)}</span>
          <div class="item-body">
            <span class="item-preview">{contentPreview(item)}</span>
            <span class="item-meta">{relativeTime(item.submittedAt)}</span>
          </div>
          <span class="badge badge--{badge.cls}" title={badge.label}>
            {badge.icon}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .my-items {
    padding: 0 16px 16px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 12px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
    padding: 24px 0;
  }

  .items-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface);
    border-radius: 10px;
    padding: 12px;
    min-height: 56px;
  }

  .type-icon {
    font-size: 20px;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }

  .item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-preview {
    font-size: 14px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta {
    font-size: 12px;
    color: var(--text-muted);
  }

  .badge {
    font-size: 18px;
    flex-shrink: 0;
  }
</style>