<script lang="ts">
	import type { MediaItem, YoutubeContent } from '@shared/types';
	import { broadcastUnlocked } from '$lib/jam-mode-state.svelte';

	interface Props { item: MediaItem; startSec?: number }
	let { item, startSec = 0 }: Props = $props();

	const content = $derived(item.content as YoutubeContent);

	let iframeEl: HTMLIFrameElement | undefined = $state();

	// Only update iframe src when the YouTube ID actually changes.
	// Setting iframe.src — even to the same value — reloads the video in all browsers.
	// We therefore track the last loaded ID and skip redundant assignments.
	// startSec is captured at load time — it is intentionally NOT reactive.
	let loadedId = '';
	$effect(() => {
		if (!iframeEl || !broadcastUnlocked.value) return;
		const id = content.youtubeId;
		if (id === loadedId) return;
		loadedId = id;
		const start = startSec > 0 ? `&start=${startSec}` : '';
		iframeEl.src =
			`https://www.youtube.com/embed/${id}` +
			`?autoplay=1&mute=0&controls=0&rel=0&modestbranding=1&enablejsapi=1${start}`;
	});
</script>

<div class="c-media-youtube">
	<iframe
		bind:this={iframeEl}
		class="c-media-youtube__frame"
		title={content.title}
		allow="autoplay; encrypted-media"
		allowfullscreen
	></iframe>
</div>

<style>
	.c-media-youtube {
		position: relative;
		width: 100%;
		height: 100%;
		/* container-type: size enables cqw/cqh for cover calculation */
		container-type: size;
		background: var(--color-broadcast-bg, #06080d);
		overflow: hidden;
	}

	.c-media-youtube__frame {
		/*
		 * Cover strategy: ensure the 16:9 iframe always fills the slot,
		 * regardless of slot aspect ratio. Overflows are clipped by parent.
		 *   - If slot is narrower than 16:9: width = 100cqw keeps width,
		 *     but height needs 100cqw × 9/16. min-height: 100cqh ensures cover.
		 *   - If slot is taller than 16:9: height = 100cqh keeps height,
		 *     but width needs 100cqh × 16/9. min-width: 100cqw ensures cover.
		 * Result: no black bars in any slot geometry.
		 */
		position: absolute;
		width:  max(100cqw, calc(100cqh * 16 / 9));
		height: max(100cqh, calc(100cqw *  9 / 16));
		top:  50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: none;
	}
</style>