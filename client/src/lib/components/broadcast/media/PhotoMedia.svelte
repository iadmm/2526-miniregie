<script lang="ts">
	import type { MediaItem, PhotoContent } from '@shared/types';
	import { fade } from 'svelte/transition';

	interface Props { item: MediaItem }
	let { item }: Props = $props();

	const content = $derived(item.content as PhotoContent);
</script>

<div class="c-media-photo">
	{#key content.url}
		<img
			in:fade={{ duration: 300 }}
			class="c-media-photo__img"
			src={content.url}
			alt={content.caption ?? ''}
		/>
	{/key}
</div>

<style>
	.c-media-photo {
		position: relative;
		width: 100%;
		height: 100%;
		background: #08090b;
		overflow: hidden;
	}

	.c-media-photo__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>