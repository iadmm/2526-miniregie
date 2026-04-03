<script lang="ts">
	import { submissions, loadMyItems } from '$lib/my-submissions.svelte';
	import type { MediaItem } from '@shared/types';

	const STATUS_LABEL: Record<MediaItem['status'], string> = {
		pending: 'Pending',
		ready: 'In queue',
		played: 'Played',
		evicted: 'Dropped',
	};

	const TYPE_LABEL: Record<string, string> = {
		note: 'Note', photo: 'Photo', gif: 'GIF', clip: 'Video', link: 'Link',
		youtube: 'YouTube', giphy: 'Giphy', ticker: 'Ticker', interview: 'Interview',
	};

	function contentPreview(item: MediaItem): string {
		const c = item.content as unknown as Record<string, unknown>;
		if ('text' in c && typeof c['text'] === 'string') return c['text'].slice(0, 80);
		if ('title' in c && typeof c['title'] === 'string') return c['title'].slice(0, 80);
		if ('url' in c && typeof c['url'] === 'string') return (c['url'] as string).slice(0, 80);
		return '—';
	}
</script>

<section class="c-go__section">
	<h2 class="c-go__section-title">
		My submissions
		<button class="c-go__refresh" type="button" onclick={loadMyItems} aria-label="Refresh">↺</button>
	</h2>

	{#if submissions.loading}
		<p class="c-go__empty">Loading…</p>
	{:else if submissions.items.length === 0}
		<p class="c-go__empty">Nothing submitted yet.</p>
	{:else}
		<ul class="c-go__items">
			{#each submissions.items as item (item.id)}
				<li class="c-go__item">
					<span class="c-go__item-type">{TYPE_LABEL[item.type] ?? item.type}</span>
					<span class="c-go__item-preview">{contentPreview(item)}</span>
					<span class="c-go__item-status c-go__item-status--{item.status}">
						{STATUS_LABEL[item.status]}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
