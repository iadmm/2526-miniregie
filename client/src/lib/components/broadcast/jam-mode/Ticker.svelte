<script lang="ts">
	import { serverState, emitTickerPass } from '$lib/server-state.svelte';
	import type { MediaItem, TickerContent } from '@shared/types';

	function tickerText(item: MediaItem): string {
		return (item.content as TickerContent).text;
	}

	// ── Data ─────────────────────────────────────────────────────

	const DEV_AUTHOR: MediaItem['author'] = { participantId: 'system:dev', displayName: 'System', team: '', role: '' };
	const DEV_TICKER_ITEMS: MediaItem[] = import.meta.env.DEV ? [
		{ id: 'dev-1', type: 'ticker', content: { text: "Bienvenue au JAM Multimédia — 48h de création collective à l'IAD" }, queuePosition: 0, status: 'ready', submittedAt: Date.now(), author: DEV_AUTHOR },
		{ id: 'dev-2', type: 'ticker', content: { text: "Soumettez vos photos, vidéos et messages via l'interface /go" }, queuePosition: 1, status: 'ready', submittedAt: Date.now(), author: DEV_AUTHOR },
		{ id: 'dev-3', type: 'ticker', content: { text: 'M4TV — la chaîne du campus, en direct depuis le studio' }, queuePosition: 2, status: 'ready', submittedAt: Date.now(), author: DEV_AUTHOR },
	] : [];

	const tickerItems = $derived(serverState.state?.pool.queueSnapshot.filter(i => i.type === 'ticker'));

	const visible = $derived(tickerItems.length > 0);

	// ── Scroll ───────────────────────────────────────────────────

	let track: HTMLDivElement | undefined;

	function onTickerPass(): void {
		const ids = tickerItems.map(i => i.id);
		if (ids.length > 0) emitTickerPass(ids);
	}

	$effect(() => {
		// Depend on items so the effect re-runs when content changes
		if (!track || tickerItems.length === 0) return;
		const rAF = requestAnimationFrame(() => {
			if (!track) return;
			// Track contains items duplicated — half is the real content width
			const duration = (track.scrollWidth / 2) / 55;
			track.style.setProperty('animation-duration', `${duration}s`);
		});
		// animationiteration fires each time the scroll loop completes one full pass
		track.addEventListener('animationiteration', onTickerPass);
		return () => {
			cancelAnimationFrame(rAF);
			track?.removeEventListener('animationiteration', onTickerPass);
		};
	});
</script>

<div class="c-ticker" class:visible={visible} aria-live="off" aria-atomic="false">
	<div class="c-ticker-track" bind:this={track}>
		{#each [...tickerItems, ...tickerItems] as item, i (i)}
			<span class="c-ticker-track__item">{tickerText(item)}</span>
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