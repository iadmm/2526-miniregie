<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';

	// ── Scroll ───────────────────────────────────────────────────

	let track: HTMLDivElement | undefined;

	const queue   = $derived(serverState.tickerQueue);
	const visible = $derived(queue.length > 0);

	function onAnimationIteration(): void {
		for (const entry of serverState.tickerQueue) {
			entry.passesLeft--;
		}
		serverState.tickerQueue = serverState.tickerQueue.filter(e => e.passesLeft > 0);
	}

	$effect(() => {
		// Depend on queue so the effect re-runs when content changes
		if (!track || queue.length === 0) return;
		const rAF = requestAnimationFrame(() => {
			if (!track) return;
			// Track contains items duplicated — half is the real content width
			const duration = (track.scrollWidth / 2) / 55;
			track.style.setProperty('animation-duration', `${duration}s`);
		});
		track.addEventListener('animationiteration', onAnimationIteration);
		return () => {
			cancelAnimationFrame(rAF);
			track?.removeEventListener('animationiteration', onAnimationIteration);
		};
	});
</script>

<div class="c-ticker" class:visible={visible} aria-live="off" aria-atomic="false">
	<div class="c-ticker-track" bind:this={track}>
		{#each [...queue, ...queue] as entry, i (`${entry.id}-${i}`)}
			<span class="c-ticker-track__item">{entry.text}</span>
			<span class="c-ticker-track__sep" aria-hidden="true">·</span>
		{/each}
	</div>
</div>

<style>
	.c-ticker {
		overflow: hidden;
		background: #080b12;
		font-size: var(--font-size-large);
		display: flex;
		align-items: center;
		position: relative;
		margin-right: var(--grid-unit);
		transition: opacity .3s linear;
		opacity: 0;
	}
	.c-ticker.visible {
		opacity: 1;
	}

	.c-ticker::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3em;
		background: linear-gradient(to right, #080b12 0%, transparent 100%);
		pointer-events: none;
		z-index: 1;
	}
	.c-ticker::after {
		content: '';
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 1em;
		background: linear-gradient(to left, #080b12 0%, transparent 100%);
		pointer-events: none;
		z-index: 1;
	}

	.c-ticker-track {
		display: inline-flex;
		white-space: nowrap;
		animation: ticker-scroll linear infinite;
	}

	.c-ticker-track__item {
		padding-right: 2em;
	}

	.c-ticker-track__sep {
		padding-right: 2em;
	}

	@keyframes ticker-scroll {
		from { transform: translateX(0); }
		to   { transform: translateX(-50%); }
	}
</style>
