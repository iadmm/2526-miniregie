<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';
	import type { JamSlots } from '$lib/server-state.svelte';
	import type { MediaItem } from '@shared/types';
	import {
		YoutubeMedia,
		ClipMedia,
		PhotoMedia,
		GifMedia,
		NoteMedia,
		LinkMedia,
	} from './media/index';
	import { jamModeState } from '$lib/jam-mode-state.svelte';
	import LowerThird from './LowerThird.svelte';
	import Ticker from './Ticker.svelte';

	const jamLayout = $derived(serverState.jamLayout);
	const jamSlots  = $derived(serverState.jamSlots);
	const lt        = $derived(serverState.lowerThird);

	// The loud slot (video) must NEVER be unmounted during a layout change — that
	// would restart the video. We keep the last known loud item so the slot stays
	// mounted even if jamSlots.loud is briefly undefined between two socket events.
	let stickyLoud: MediaItem | undefined = $state();
	$effect(() => {
		if (jamSlots.loud) stickyLoud = jamSlots.loud;
	});

	// ── YouTube seek offset ──────────────────────────────────────
	// When the component mounts after a refresh/reconnect, we seek to the
	// current position so the video doesn't restart from 0.
	function loudStartSec(): number {
		const meta = jamModeState.slotTimings.loud;
		if (!meta) return 0;
		return Math.floor((Date.now() - meta.startedAt) / 1000);
	}

</script>

<div class="c-broadcast-screen">
	<div class="o-layout-area" data-layout={jamLayout ?? 'IDLE'}>

		<!-- Loud slot: always in DOM, hidden via CSS to preserve video playback state -->
		<div
			class="o-layout-area__slot o-layout-area__slot--loud"
			class:o-layout-area__slot--hidden={!jamSlots.loud}
			aria-hidden={!jamSlots.loud}
		>
			{#if stickyLoud?.type === 'youtube'}
				<YoutubeMedia item={stickyLoud} startSec={loudStartSec()} />
			{:else if stickyLoud?.type === 'clip'}
				<ClipMedia item={stickyLoud} />
			{/if}
		</div>

		{#if jamSlots.visual}
			<div class="o-layout-area__slot o-layout-area__slot--visual">
				{#if jamSlots.visual.type === 'photo'}
					<PhotoMedia item={jamSlots.visual} />
				{:else if jamSlots.visual.type === 'gif' || jamSlots.visual.type === 'giphy'}
					<GifMedia item={jamSlots.visual} />
				{:else if jamSlots.visual.type === 'link'}
					<LinkMedia item={jamSlots.visual} />
				{/if}
			</div>
		{/if}

		{#if jamSlots.visual2}
			<div class="o-layout-area__slot o-layout-area__slot--visual2">
				{#if jamSlots.visual2.type === 'photo'}
					<PhotoMedia item={jamSlots.visual2} />
				{:else if jamSlots.visual2.type === 'gif' || jamSlots.visual2.type === 'giphy'}
					<GifMedia item={jamSlots.visual2} />
				{:else if jamSlots.visual2.type === 'link'}
					<LinkMedia item={jamSlots.visual2} />
				{/if}
			</div>
		{/if}

		{#if jamSlots.note}
			<div class="o-layout-area__slot o-layout-area__slot--note">
				<NoteMedia item={jamSlots.note} />
			</div>
		{/if}

		{#if jamLayout === 'IDLE' || (!jamSlots.loud && !jamSlots.visual && !jamSlots.note)}
			<div class="o-layout-area__slot o-layout-area__slot--idle">— pool empty —</div>
		{/if}

	</div>

	<!-- Persistent chrome — lives above layout transitions -->
	<Ticker />
	<LowerThird visible={lt !== null} label={lt?.label ?? ''} name={lt?.name ?? ''} role={lt?.role ?? ''} />

	<div class="c-broadcast-screen__debug" aria-hidden="true">{jamLayout ?? 'IDLE'}</div>
</div>
