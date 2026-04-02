<script lang="ts">
	import type { LowerThirdState } from '$lib/server-state.svelte';

	interface Props {
		lowerThird: LowerThirdState | null;
	}
	let { lowerThird }: Props = $props();

	// Snapshot: keeps content visible during the exit animation after lowerThird → null.
	let displayed = $state<LowerThirdState | null>(null);
	let leaving   = $state(false);
	let leaveTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (lowerThird !== null) {
			// New content incoming — cancel any in-flight exit.
			if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null; }
			leaving   = false;
			displayed = lowerThird;
		} else if (displayed !== null && !leaving) {
			// lowerThird just became null — start exit animation.
			leaving   = true;
			leaveTimer = setTimeout(() => {
				leaving    = false;
				displayed  = null;
				leaveTimer = null;
			}, 480); // 80ms delay + 400ms longest wipe-out = 480ms
		}
	});
</script>

<div
	class="c-lower-third"
	class:visible={displayed !== null && !leaving}
	class:leaving
	aria-live="polite"
>
	<div class="c-lower-third__label">
		<span class="c-lower-third__type">{displayed?.label || 'M4TV'}</span>
		{#if displayed?.role}
			<div class="c-lower-third__role">{displayed.role}</div>
		{/if}
	</div>
	<div class="c-lower-third__block">
		<div class="c-lower-third__name">{displayed?.name}</div>
	</div>
</div>

<style>

	/*
	 * Base state: sub-elements are clipped (invisible) until .visible is applied.
	 * .visible  — wipe-in  : label 220ms, block 380ms+80ms delay, power2.out
	 * .leaving  — wipe-out : block 280ms, label 380ms+80ms delay, power2.in
	 *             direction reverses (left edge clips instead of right)
	 */
	.c-lower-third {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--gap-unit);
	}

	.c-lower-third__label {
		display: flex;
		flex-direction: row;
		gap: var(--gap-unit);
		clip-path: inset(0 100% 0 0);
	}

	.c-lower-third__block {
		clip-path: inset(0 100% 0 0);
	}

	.c-lower-third.visible .c-lower-third__label {
		animation: bcast-lt-wipe 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.c-lower-third.visible .c-lower-third__block {
		animation: bcast-lt-wipe 380ms cubic-bezier(0.16, 1, 0.3, 1) 80ms forwards;
	}

	@keyframes bcast-lt-wipe {
		from { clip-path: inset(0 100% 0 0); }
		to   { clip-path: inset(0 0% 0 0); }
	}

	@keyframes bcast-lt-wipe-out {
		from { clip-path: inset(0 0% 0 0); }
		to   { clip-path: inset(0 100% 0 0); }
	}

	/* Exit: label lingers slightly while block wipes out first */
	.c-lower-third.leaving .c-lower-third__block {
		animation: bcast-lt-wipe-out 280ms cubic-bezier(0.55, 0, 1, 0.45) forwards;
	}

	.c-lower-third.leaving .c-lower-third__label {
		animation: bcast-lt-wipe-out 380ms cubic-bezier(0.55, 0, 1, 0.45) 80ms forwards;
	}

	.c-lower-third__role {
		font-family: var(--font-editorial);
		font-size: var(--font-size-medium);
		align-items: center;
		display: flex;
		background: var(--color-danger-dark);
		padding: 0 calc(1 * var(--grid-unit)) 0 calc(.5 * var(--grid-unit));
	}
	.c-lower-third__type {
		background: var(--color-danger);
		padding: 0 calc(1 * var(--grid-unit));
		display: flex;
		align-items: center;
	}
	.c-lower-third__block {
		display: flex;
		flex-direction: column;
		background: white;
		padding: calc(.5 * var(--grid-unit)) calc(2 * var(--grid-unit)) calc(.5 * var(--grid-unit)) calc(1 * var(--grid-unit));
	}
	.c-lower-third__name {
		color: var(--color-broadcast-bg);
		font-family: var(--font-display);
		font-size: var(--font-size-2x-large);
	}
</style>