<script lang="ts">
	import type { SlotChyronState } from '$lib/server-state.svelte';

	interface Props {
		slotChyron: SlotChyronState | null;
	}

	let { slotChyron }: Props = $props();

	// Snapshot: keeps content visible during the exit animation after slotChyron → null.
	let displayed = $state<SlotChyronState | null>(null);
	let leaving   = $state(false);
	let leaveTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (slotChyron !== null) {
			if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null; }
			leaving   = false;
			displayed = slotChyron;
		} else if (displayed !== null && !leaving) {
			leaving   = true;
			leaveTimer = setTimeout(() => {
				leaving    = false;
				displayed  = null;
				leaveTimer = null;
			}, 360); // 80ms delay + 280ms longest wipe-out
		}
	});

	// HH:MM format for submission time
	const timeStr = $derived.by(() => {
		if (!displayed?.submittedAt) return '';
		return new Date(displayed.submittedAt).toLocaleTimeString('fr-BE', {
			hour: '2-digit', minute: '2-digit', hour12: false,
		});
	});
</script>

<!--
  SlotChyron — compact source tag for visual slots.
  Single-row horizontal bar: [FLAG] [text content].
  Positioned by the parent (absolute, bottom-left, 5% inset).
  Lighter editorial footprint than LowerThird — lives on the image.
  Entry: clip-path wipe, flag 160ms then bloc 260ms+40ms delay, power2.out.
  Exit: bloc 200ms, flag 280ms+80ms delay, power2.in.
-->
<div
	class="c-slot-chyron"
	class:visible={displayed !== null && !leaving}
	class:leaving
	aria-live="polite"
>
	<div class="c-slot-chyron__flag">
		<span>{displayed?.label ?? ''}</span>
	</div>
	<div class="c-slot-chyron__bloc">
		{#if displayed?.caption}
			<span class="c-slot-chyron__caption">{displayed.caption}</span>
			<span class="c-slot-chyron__meta">{displayed.name}</span>
		{:else}
			<span class="c-slot-chyron__name">{displayed?.name ?? ''}</span>
			{#if timeStr}
				<span class="c-slot-chyron__meta">{timeStr}</span>
			{/if}
		{/if}
	</div>
</div>

<style>
	/*
	 * Base state: sub-elements are clipped (invisible).
	 * .visible  — wipe-in  : flag 160ms, bloc 260ms+40ms delay, power2.out
	 * .leaving  — wipe-out : bloc 200ms, flag 280ms+80ms delay, power2.in
	 */
	.c-slot-chyron {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		line-height: 1;
	}

	.c-slot-chyron__flag,
	.c-slot-chyron__bloc {
		clip-path: inset(0 100% 0 0);
	}

	/* ── Entry ──────────────────────────────────────────────── */

	.c-slot-chyron.visible .c-slot-chyron__flag {
		animation: chyron-wipe-in 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.c-slot-chyron.visible .c-slot-chyron__bloc {
		animation: chyron-wipe-in 260ms cubic-bezier(0.16, 1, 0.3, 1) 40ms forwards;
	}

	/* ── Exit ───────────────────────────────────────────────── */

	.c-slot-chyron.leaving .c-slot-chyron__bloc {
		animation: chyron-wipe-out 200ms cubic-bezier(0.55, 0, 1, 0.45) forwards;
	}

	.c-slot-chyron.leaving .c-slot-chyron__flag {
		animation: chyron-wipe-out 280ms cubic-bezier(0.55, 0, 1, 0.45) 80ms forwards;
	}

	@keyframes chyron-wipe-in {
		from { clip-path: inset(0 100% 0 0); }
		to   { clip-path: inset(0 0% 0 0); }
	}

	@keyframes chyron-wipe-out {
		from { clip-path: inset(0 0% 0 0); }
		to   { clip-path: inset(0 100% 0 0); }
	}

	/* ── Flag ───────────────────────────────────────────────── */

	.c-slot-chyron__flag {
		background: var(--color-success);
		color: var(--color-broadcast-bg);
		font-family: var(--font-editorial);
		font-size: var(--font-size-base);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: calc(0.45 * var(--grid-unit)) calc(0.75 * var(--grid-unit));
		display: flex;
		align-items: center;
	}

	/* ── Bloc ───────────────────────────────────────────────── */

	.c-slot-chyron__bloc {
		background: var(--color-broadcast-bg);
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: calc(0.6 * var(--grid-unit));
		padding: calc(0.45 * var(--grid-unit)) calc(1.25 * var(--grid-unit)) calc(0.45 * var(--grid-unit)) calc(0.75 * var(--grid-unit));
	}

	.c-slot-chyron__name,
	.c-slot-chyron__caption {
		font-family: var(--font-display);
		font-size: var(--font-size-medium);
		font-weight: 400;
		color: var(--color-ink-88);
	}

	.c-slot-chyron__meta {
		font-family: var(--font-editorial);
		font-size: var(--font-size-medium);
		font-weight: 400;
		color: var(--color-ink-42);
	}
</style>
