<script lang="ts">
	import type { MediaItem } from '@shared/types';
	import { YoutubeMedia, ClipMedia } from '../media/index';
	import { jamModeState } from '$lib/jam-mode-state.svelte';

	interface Props {
		item:   MediaItem | undefined;
		hidden: boolean;
	}

	let { item, hidden }: Props = $props();

	// Never unmount during a layout change — that would restart the video.
	let stickyItem: MediaItem | undefined = $state();
	$effect(() => {
		if (item) stickyItem = item;
	});

	// On mount after reconnect, seek to the current playback position.
	function startSec(): number {
		const meta = jamModeState.slotTimings.loud;
		if (!meta) return 0;
		return Math.floor((Date.now() - meta.startedAt) / 1000);
	}
</script>

<div
	class="o-layout-area__slot o-layout-area__slot--loud"
	class:o-layout-area__slot--hidden={hidden}
	aria-hidden={hidden}
>
	{#if stickyItem?.type === 'youtube'}
		<YoutubeMedia item={stickyItem} startSec={startSec()} />
	{:else if stickyItem?.type === 'clip'}
		<ClipMedia item={stickyItem} />
	{/if}
</div>