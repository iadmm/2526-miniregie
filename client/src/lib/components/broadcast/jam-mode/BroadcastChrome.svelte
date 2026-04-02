<script lang="ts">
	import Branding from './Branding.svelte';
	import Ticker from './Ticker.svelte';
	import Clock from "$lib/components/broadcast/jam-mode/Clock.svelte";
</script>

<div class="c-branding">
	<Branding />
	<Clock />
	<Ticker />
</div>

<style>
	.c-branding{
		position: absolute;
		bottom: calc(4* var(--grid-unit));
		left: calc(5* var(--grid-unit));
		display: flex;
		height: calc(3*var(--grid-unit));
	}
</style>