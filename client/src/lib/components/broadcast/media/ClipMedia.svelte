<script lang="ts">
	import type { MediaItem, ClipContent } from '@shared/types';

	interface Props { item: MediaItem }
	let { item }: Props = $props();

	const content = $derived(item.content as ClipContent);

	let videoEl: HTMLVideoElement | undefined = $state();

	// Only reload when the URL actually changes — same as YoutubeMedia's approach.
	// Calling video.load() when the src hasn't changed would restart playback.
	let loadedUrl = '';
	$effect(() => {
		if (!videoEl) return;
		const url = content.url;
		if (url === loadedUrl) return;
		loadedUrl = url;
		videoEl.src = url;
		videoEl.load();
		videoEl.play().catch(() => {/* autoplay policy — silently ignore */});
	});
</script>

<div class="c-media-clip">
	<video
		bind:this={videoEl}
		class="c-media-clip__video"
		autoplay
		loop
		playsinline
	></video>
</div>

<style>
	.c-media-clip {
		position: relative;
		width: 100%;
		height: 100%;
		background: #000;
		overflow: hidden;
	}

	.c-media-clip__video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>