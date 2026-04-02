<script lang="ts">
	import Branding from './Branding.svelte';
	import Ticker from './Ticker.svelte';
	import Clock from "$lib/components/broadcast/jam-mode/Clock.svelte";
	import LowerThird from "$lib/components/broadcast/jam-mode/LowerThird.svelte";
	import { serverState } from '$lib/server-state.svelte';
	import { isCompanionIntroActive } from '$lib/companion-sequence.svelte';
	import { dualSequence } from '$lib/dual-sequence.svelte';

	const introActive  = $derived(isCompanionIntroActive());

	const lowerThird = $derived.by(() => {
		if (dualSequence.phase === 'first' || dualSequence.phase === 'second') {
			return dualSequence.lowerThird;
		}
		if (introActive) return null;
		return serverState.lowerThird;
	});
</script>

<div class="c-broadcast-chrome">
	<LowerThird {lowerThird} />
	<div class="c-branding__branding">
		<Branding />
		<Clock />
		<Ticker />
	</div>
</div>

<style>
	.c-broadcast-chrome {
		--gap-unit: calc(var(--grid-unit)*.5);
		position: absolute;
		bottom: calc(4* var(--grid-unit));
		left: calc(5* var(--grid-unit));
		display: flex;
		flex-direction: column;
		gap: var(--gap-unit);
	}
	.c-branding__branding {
		display: flex;
		height: calc(3*var(--grid-unit));
		animation: bcast-bar-enter 640ms cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 120ms;
	}

	/*
	 * Broadcast bar entrance — left-to-right clip-path wipe, expo-out deceleration.
	 * The bar "draws itself" onto screen as if cut by a broadcast switcher.
	 * A 4px vertical settle adds physical weight to the stamp-in.
	 */
	@keyframes bcast-bar-enter {
		from {
			clip-path: inset(0 100% 0 0);
			translate: 0 4px;
		}
		to {
			clip-path: inset(0 0% 0 0);
			translate: 0 0;
		}
	}
</style>