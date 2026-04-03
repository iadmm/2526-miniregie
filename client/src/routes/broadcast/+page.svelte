<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';
	import { expoOut, cubicIn } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import PreJamIdle from '$lib/components/broadcast/PreJamIdle.svelte';
	import CountdownToJam from '$lib/components/broadcast/CountdownToJam.svelte';
	import JamMode from '$lib/components/broadcast/JamMode.svelte';
	import EndOfCountdown from '$lib/components/broadcast/EndOfCountdown.svelte';
	import PostJamIdle from '$lib/components/broadcast/PostJamIdle.svelte';
	import MicroTrottoir from '$lib/components/broadcast/MicroTrottoir.svelte';
	import StartJam from '$lib/components/broadcast/StartJam.svelte';

	const activeApp = $derived(serverState.state?.broadcast.activeApp ?? 'pre-jam-idle');

	// Iris wipe: collapses to a vertical hairline then expands into the next app.
	// Uses clip-path: inset(0 X% 0 X%) — symmetric horizontal blinders.
	function iris(_node: Element, { duration = 400, easing = expoOut }: { duration?: number; easing?: (t: number) => number } = {}): TransitionConfig {
		return {
			duration,
			css: (t: number) => {
				const x = (1 - easing(t)) * 50;
				return `clip-path: inset(0 ${x}% 0 ${x}%)`;
			}
		};
	}
</script>

{#if activeApp === 'pre-jam-idle'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<PreJamIdle />
	</div>
{:else if activeApp === 'countdown-to-jam'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<CountdownToJam />
	</div>
{:else if activeApp === 'start-jam'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<StartJam />
	</div>
{:else if activeApp === 'jam-mode'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<JamMode />
	</div>
{:else if activeApp === 'end-of-countdown'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<EndOfCountdown />
	</div>
{:else if activeApp === 'post-jam-idle'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<PostJamIdle />
	</div>
{:else if activeApp === 'micro-trottoir'}
	<div class="app-layer" in:iris={{ duration: 500, easing: expoOut }} out:iris={{ duration: 200, easing: cubicIn }}>
		<MicroTrottoir />
	</div>
{/if}

<style>
	.app-layer {
		position: absolute;
		inset: 0;
	}
</style>