<script lang="ts">
	import type { MediaItem, GifContent } from '@shared/types';
	import { fade } from 'svelte/transition';

	interface Props { item: MediaItem }
	let { item }: Props = $props();

	const content = $derived(item.content as GifContent);
</script>

<div class="c-media-gif">
	{#key content.url}
		<img
			in:fade={{ duration: 300 }}
			class="c-media-gif__img"
			src={content.url}
			alt={content.caption ?? ''}
		/>
	{/key}
</div>

<style>
	.c-media-gif {
		position: relative;
		width: 100%;
		height: 100%;
		background: #08090b;
		overflow: hidden;
	}

	.c-media-gif__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain; /* preserve aspect ratio — GIFs often have specific ratios */
	}
</style>