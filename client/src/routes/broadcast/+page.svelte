<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';
	import PreJamIdle from '$lib/components/broadcast/PreJamIdle.svelte';
	import CountdownToJam from '$lib/components/broadcast/CountdownToJam.svelte';
	import JamMode from '$lib/components/broadcast/JamMode.svelte';
	import EndOfCountdown from '$lib/components/broadcast/EndOfCountdown.svelte';
	import PostJamIdle from '$lib/components/broadcast/PostJamIdle.svelte';
	import MicroTrottoir from '$lib/components/broadcast/MicroTrottoir.svelte';

	const activeApp = $derived(serverState.state?.broadcast.activeApp ?? 'pre-jam-idle');
</script>

{#if activeApp === 'pre-jam-idle'}
	<PreJamIdle />
{:else if activeApp === 'countdown-to-jam'}
	<CountdownToJam />
{:else if activeApp === 'jam-mode'}
	<JamMode />
{:else if activeApp === 'end-of-countdown'}
	<EndOfCountdown />
{:else if activeApp === 'post-jam-idle'}
	<PostJamIdle />
{:else if activeApp === 'micro-trottoir'}
	<MicroTrottoir />
{/if}