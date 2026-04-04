<script lang="ts">
	import type { MediaItem } from '@shared/types';
	import { serverState } from '$lib/server-state.svelte';
	import { companionSequence, isCompanionIntroActive } from '$lib/companion-sequence.svelte';
	import { dualSequence } from '$lib/dual-sequence.svelte';
	import { NoteMedia } from '../media/index';
	import LoudSlot from './LoudSlot.svelte';
	import VisualSlot from './VisualSlot.svelte';
	import PoolEmpty from "$lib/components/broadcast/jam-mode/PoolEmpty.svelte";

	const introActive = $derived(isCompanionIntroActive());
	const jamLayout   = $derived(serverState.jamLayout);
	const jamSlots    = $derived(serverState.jamSlots);

	const visualItem = $derived.by((): MediaItem | null => {
		if (dualSequence.phase === 'first')  return dualSequence.visual1;
		if (dualSequence.phase === 'second') return dualSequence.visual2;
		return jamSlots.visual ?? null;
	});

	const visual2Item = $derived.by((): MediaItem | null => {
		if (dualSequence.phase !== 'idle') return dualSequence.visual2;
		return jamSlots.visual2 ?? null;
	});

	const loudHidden    = $derived(!jamSlots.loud || introActive);
	const visualHidden  = $derived(dualSequence.phase === 'second');
	const visual2Hidden = $derived(dualSequence.phase === 'first');

	const companionPhase = $derived(
		companionSequence.phase !== 'idle' ? companionSequence.phase : undefined
	);
	const dualPhase = $derived(
		dualSequence.phase !== 'idle' ? dualSequence.phase : undefined
	);
</script>

<div
	class="o-layout-area"
	data-layout={jamLayout ?? 'IDLE'}
	data-companion-phase={companionPhase}
	data-dual-phase={dualPhase}
>
	<LoudSlot item={jamSlots.loud} hidden={loudHidden} />

	{#if visualItem}
		<VisualSlot item={visualItem} slotName="visual" hidden={visualHidden} />
	{/if}

	{#if visual2Item}
		<VisualSlot item={visual2Item} slotName="visual2" hidden={visual2Hidden} />
	{/if}

	{#if jamSlots.note}
		<div class="o-layout-area__slot o-layout-area__slot--note">
			<NoteMedia item={jamSlots.note} />
		</div>
	{/if}

	{#if jamLayout === 'IDLE' || jamLayout === 'QR_CARD' || (!jamSlots.loud && !visualItem && !jamSlots.note)}
		<PoolEmpty />
	{/if}
</div>