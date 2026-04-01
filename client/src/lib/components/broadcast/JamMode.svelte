<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';
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
	import { companionSequence, isCompanionIntroActive } from '$lib/companion-sequence.svelte';

	const introActive = $derived(isCompanionIntroActive());
	import { dualSequence } from '$lib/dual-sequence.svelte';
	import LowerThird from './LowerThird.svelte';
	import SlotChyron from './SlotChyron.svelte';
	import Ticker from './Ticker.svelte';
	import Branding from "$lib/components/broadcast/Branding.svelte";

	const jamLayout  = $derived(serverState.jamLayout);
	const jamSlots   = $derived(serverState.jamSlots);
	const lt         = $derived(serverState.lowerThird);
	const slotChyron = $derived(serverState.slotChyron);

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

	// ── Effective lower-third ────────────────────────────────────
	// Dual sequence overrides server lower-third during solo phases.
	// Companion intro suppresses the server lower-third (loud will fire after active).
	const effectiveLt = $derived.by(() => {
		if (dualSequence.phase === 'first' || dualSequence.phase === 'second') {
			return dualSequence.lowerThird;
		}
		if (introActive) return null;
		return lt;
	});

	// ── Chyron visibility ────────────────────────────────────────
	// Only shown during companion intro phase — the intro *is* the attribution moment.
	const showChyron = $derived(slotChyron !== null && companionSequence.phase === 'intro');

	// ── Dual sequence slot content ───────────────────────────────
	const isDualActive = $derived(dualSequence.phase !== 'idle');

	// Which item to render in the visual slot (dual first/second override normal slots)
	const visualItem = $derived.by((): MediaItem | null => {
		if (dualSequence.phase === 'first')  return dualSequence.visual1;
		if (dualSequence.phase === 'second') return dualSequence.visual2;
		return jamSlots.visual ?? null;
	});

	// Which item to render in the visual2 slot
	const visual2Item = $derived.by((): MediaItem | null => {
		if (isDualActive) return dualSequence.visual2;
		return jamSlots.visual2 ?? null;
	});

	// data-companion-phase attribute (undefined removes the attribute)
	const companionPhaseAttr = $derived(
		companionSequence.phase !== 'idle' ? companionSequence.phase : undefined
	);

	// data-dual-phase attribute (undefined removes the attribute)
	const dualPhaseAttr = $derived(
		dualSequence.phase !== 'idle' ? dualSequence.phase : undefined
	);
</script>

<div class="c-broadcast-screen">
	<div
		class="o-layout-area"
		data-layout={jamLayout ?? 'IDLE'}
		data-companion-phase={companionPhaseAttr}
		data-dual-phase={dualPhaseAttr}
	>

		<!-- Loud slot: always in DOM, hidden during companion intro to preserve audio -->
		<div
			class="o-layout-area__slot o-layout-area__slot--loud"
			class:o-layout-area__slot--hidden={!jamSlots.loud || introActive}
			aria-hidden={!jamSlots.loud || introActive}
		>
			{#if stickyLoud?.type === 'youtube'}
				<YoutubeMedia item={stickyLoud} startSec={loudStartSec()} />
			{:else if stickyLoud?.type === 'clip'}
				<ClipMedia item={stickyLoud} />
			{/if}
		</div>

		<!-- Visual slot: companion intro, dual solo, or normal -->
		{#if visualItem}
			<div
				class="o-layout-area__slot o-layout-area__slot--visual"
				class:o-layout-area__slot--hidden={dualSequence.phase === 'second'}
			>
				{#if visualItem.type === 'photo'}
					<PhotoMedia item={visualItem} />
				{:else if visualItem.type === 'gif' || visualItem.type === 'giphy'}
					<GifMedia item={visualItem} />
				{:else if visualItem.type === 'link'}
					<LinkMedia item={visualItem} />
				{/if}
				<SlotChyron
					visible={showChyron}
					label={slotChyron?.label ?? ''}
					name={slotChyron?.name ?? ''}
					caption={slotChyron?.caption}
					submittedAt={slotChyron?.submittedAt}
				/>
			</div>
		{/if}

		<!-- Visual2 slot: rendered during all dual phases so it can animate in 'together' -->
		{#if visual2Item}
			<div
				class="o-layout-area__slot o-layout-area__slot--visual2"
				class:o-layout-area__slot--hidden={dualSequence.phase === 'first'}
			>
				{#if visual2Item.type === 'photo'}
					<PhotoMedia item={visual2Item} />
				{:else if visual2Item.type === 'gif' || visual2Item.type === 'giphy'}
					<GifMedia item={visual2Item} />
				{:else if visual2Item.type === 'link'}
					<LinkMedia item={visual2Item} />
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
	<Branding />
	<Ticker />
	<LowerThird
		visible={effectiveLt !== null}
		label={effectiveLt?.label ?? ''}
		name={effectiveLt?.name ?? ''}
		role={effectiveLt?.role ?? ''}
	/>
</div>
