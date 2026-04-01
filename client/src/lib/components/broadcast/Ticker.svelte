<script lang="ts">
	import { serverState, emitTickerPass } from '$lib/server-state.svelte';
	import type { MediaItem, TickerContent } from '@shared/types';

	function tickerText(item: MediaItem): string {
		return (item.content as TickerContent).text;
	}

	// ── Data ─────────────────────────────────────────────────────

	const tickerItems = $derived(
		serverState.state?.pool.queueSnapshot.filter(i => i.type === 'ticker') ?? []
	);

	const chyronActive = $derived(serverState.lowerThird !== null || serverState.slotChyron !== null);
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

<div class="c-ticker" class:has-messages={visible} aria-live="off" aria-atomic="false">
	<!-- Scrolling text -->
	<div class="c-ticker-track__wrapper" class:hidden={chyronActive}>
		<div class="c-ticker-track" bind:this={track}>
			{#each [...tickerItems, ...tickerItems] as item, i (i)}
				<span class="c-ticker-track__item">{tickerText(item)}</span>
				<span class="c-ticker-track__sep" aria-hidden="true">·</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.c-ticker {
		height: var(--hud-m);
		display: flex;
		align-items: stretch;
		overflow: hidden;

		background: #080b12;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	/* ── Scroll track — conditional, fades in with messages ─────────────── */

	.c-ticker-track__wrapper {
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		/* Hidden by default — track is empty, not the band */
		opacity: 0;
		transition: opacity 400ms ease;
	}

	/* Reveal when queue has items AND no chyron is suppressing it */
	.c-ticker.has-messages .c-ticker-track__wrapper:not(.hidden) {
		opacity: 1;
	}

	/* Suppress during lower-third / slot-chyron attribution display */
	.c-ticker-track__wrapper.hidden {
		opacity: 0;
		pointer-events: none;
	}

	/* animation-duration injected by JS: track.scrollWidth / 2 / 55px·s⁻¹ */
	.c-ticker-track {
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
		animation: ticker-scroll linear infinite;
		will-change: transform;
	}

	.c-ticker-track__item {
		font-family: var(--font-editorial, 'Schibsted Grotesk', sans-serif);
		font-size: var(--bcast-fz-small, 10px);
		font-weight: 400;
		/* Intentionally one step below clock (ink-65 vs ink-88) */
		color: var(--color-ink-65, rgba(255, 255, 255, 0.65));
		letter-spacing: 0.025em;
		line-height: 1;
		padding-right: clamp(20px, 1.9vw, 30px);
	}

	.c-ticker-track__sep {
		flex-shrink: 0;
		font-size: var(--bcast-fz-fine, 8px);
		color: var(--color-brand, #1ac0d7);
		opacity: 0.55;
		padding-right: clamp(20px, 1.9vw, 30px);
		line-height: 1;
		user-select: none;
	}

	@keyframes ticker-scroll {
		from { transform: translateX(0); }
		to   { transform: translateX(-50%); }
	}
</style>