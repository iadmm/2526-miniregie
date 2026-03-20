<script lang="ts">
  import type { ScoredMediaItem } from '@shared/types';

  interface Props {
    item: ScoredMediaItem;
    rank: number;
    banned: boolean;
    onPin:   (id: string) => void;
    onSkip:  (id: string) => void;
    onEvict: (id: string) => void;
    onUnban: (authorId: string) => void;
    onEdit:  (item: ScoredMediaItem) => void;
  }

  const { item, rank, banned, onPin, onSkip, onEvict, onUnban, onEdit }: Props = $props();

  let confirmEvict = $state(false);

  function getPreviewText(i: ScoredMediaItem): string {
    const c = i.content as Record<string, unknown>;
    if ('text' in c && typeof c.text === 'string') return c.text;
    if ('title' in c && typeof c.title === 'string') return c.title;
    if ('caption' in c && typeof c.caption === 'string') return c.caption;
    if ('url' in c && typeof c.url === 'string') return c.url;
    return '';
  }

  function getThumbnail(i: ScoredMediaItem): string | null {
    const c = i.content as Record<string, unknown>;
    if ((i.type === 'photo' || i.type === 'gif') && typeof c.url === 'string') return c.url;
    if (i.type === 'youtube' && typeof c.thumbnail === 'string') return c.thumbnail;
    if (i.type === 'link' && typeof c.thumbnail === 'string') return c.thumbnail;
    return null;
  }

  function scoreClass(s: ScoredMediaItem): string {
    if (s.cooldownEndsAt !== null) return 'score-cooldown';
    if (s.score >= 200)  return 'score-high';
    if (s.score >= 100)  return 'score-mid';
    return 'score-low';
  }

  const preview   = $derived(getPreviewText(item));
  const thumbnail = $derived(getThumbnail(item));
</script>

<div class="item" class:pinned={item.pinned} class:banned>
  <!-- Rank + thumbnail -->
  <div class="rank">{rank}</div>

  {#if thumbnail}
    <img class="thumb" src={thumbnail} alt="" loading="lazy" />
  {:else}
    <div class="thumb-placeholder type-{item.type}">{item.type.slice(0, 4).toUpperCase()}</div>
  {/if}

  <!-- Main info -->
  <div class="info">
    <div class="top-row">
      <span class="author">{item.author.displayName}</span>
      {#if item.author.team}
        <span class="team">{item.author.team}</span>
      {/if}
      {#if item.pinned}
        <span class="pin-badge">★ pinned</span>
      {/if}
      {#if banned}
        <span class="ban-badge">banned</span>
      {/if}
    </div>
    <div class="preview">{preview || '—'}</div>
    <div class="meta-row">
      <span class="score {scoreClass(item)}">{item.score}</span>
      {#if item.displayedCount > 0}
        <span class="stat">shown:{item.displayedCount}</span>
      {/if}
      {#if item.skippedCount > 0}
        <span class="stat">skip:{item.skippedCount}</span>
      {/if}
      {#if item.cooldownEndsAt !== null}
        <span class="cooldown">cooldown</span>
      {/if}
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    {#if banned}
      <button class="act act-unban" onclick={() => onUnban(item.author.participantId)}>Unban</button>
    {/if}
    <button
      class="act act-pin"
      class:active={item.pinned}
      title={item.pinned ? 'Already pinned' : 'Pin to top'}
      onclick={() => onPin(item.id)}
      disabled={item.pinned}
    >Pin</button>
    <button class="act act-skip" title="Skip (lower score)" onclick={() => onSkip(item.id)}>Skip</button>
    {#if !confirmEvict}
      <button class="act act-evict" title="Evict from queue" onclick={() => { confirmEvict = true; }}>Evict</button>
    {:else}
      <button class="act act-evict-confirm" onclick={() => { confirmEvict = false; onEvict(item.id); }}>Confirm?</button>
      <button class="act act-cancel" onclick={() => { confirmEvict = false; }}>×</button>
    {/if}
    <button class="act act-edit" title="Edit metadata" onclick={() => onEdit(item)}>Edit</button>
  </div>
</div>

<style>
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-dim);
    background: var(--bg-panel);
    transition: background 0.1s;
  }
  .item:hover { background: var(--bg-hover); }
  .item.pinned { border-left: 2px solid var(--accent); }
  .item.banned { opacity: 0.6; }

  .rank {
    font-size: 10px;
    color: var(--text-dim);
    font-family: var(--font-mono);
    min-width: 16px;
    text-align: center;
  }

  .thumb {
    width: 40px;
    height: 30px;
    object-fit: cover;
    border-radius: var(--radius);
    flex-shrink: 0;
    background: var(--bg-surface);
  }

  .thumb-placeholder {
    width: 40px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.05em;
    border-radius: var(--radius);
    flex-shrink: 0;
    background: var(--bg-surface);
    color: var(--text-dim);
  }
  .type-note     { color: #a3e635; background: rgba(163,230,53,0.08); }
  .type-photo    { color: #60a5fa; background: rgba(96,165,250,0.08); }
  .type-gif      { color: #c084fc; background: rgba(192,132,252,0.08); }
  .type-clip     { color: #fb923c; background: rgba(251,146,60,0.08); }
  .type-youtube  { color: #f87171; background: rgba(248,113,113,0.08); }
  .type-ticker   { color: #fbbf24; background: rgba(251,191,36,0.08); }
  .type-inter    { color: #34d399; background: rgba(52,211,153,0.08); }
  .type-link     { color: var(--text-dim); background: var(--bg-surface); }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .top-row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .author {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .team {
    font-size: 10px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .pin-badge {
    font-size: 9px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.06em;
  }

  .ban-badge {
    font-size: 9px;
    font-weight: 700;
    color: var(--live);
    background: rgba(229,57,53,0.12);
    padding: 1px 4px;
    border-radius: var(--radius);
  }

  .preview {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .score {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    padding: 1px 5px;
    border-radius: var(--radius);
  }
  .score-high    { color: var(--ready);   background: rgba(34,197,94,0.12); }
  .score-mid     { color: var(--warning); background: rgba(245,158,11,0.12); }
  .score-low     { color: var(--text-dim); background: var(--bg-surface); }
  .score-cooldown { color: var(--text-dim); background: var(--bg-surface); text-decoration: line-through; }

  .stat {
    font-size: 9px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .cooldown {
    font-size: 9px;
    color: var(--warning);
    font-family: var(--font-mono);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .act {
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    border-radius: var(--radius);
    border: 1px solid var(--border-dim);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .act:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }
  .act:disabled { opacity: 0.3; cursor: not-allowed; }

  .act-pin.active { color: var(--accent); border-color: var(--accent-dim); }
  .act-pin:hover:not(:disabled) { color: var(--accent); }

  .act-skip:hover:not(:disabled) { color: var(--warning); border-color: var(--warning); }

  .act-evict:hover:not(:disabled) { color: var(--live); border-color: var(--live); }
  .act-evict-confirm {
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 700;
    border-radius: var(--radius);
    background: var(--live);
    color: #fff;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }
  .act-evict-confirm:hover { opacity: 0.85; }

  .act-cancel { color: var(--text-dim); }

  .act-unban {
    color: var(--ready);
    border-color: rgba(34,197,94,0.3);
  }
  .act-unban:hover:not(:disabled) { background: rgba(34,197,94,0.1); }
</style>
