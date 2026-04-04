<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';

	let {title} = $props();

	let now = $state(Date.now());

	const nextTriggerAt = $derived(serverState.state?.broadcast.nextTriggerAt ?? null);
	const msRemaining = $derived(nextTriggerAt !== null ? Math.max(0, nextTriggerAt - now) : null);

	function formatCountdown(ms: number): string {
		const totalSecs = Math.ceil(ms / 1000);
		const h = Math.floor(totalSecs / 3600);
		const m = Math.floor((totalSecs % 3600) / 60);
		const s = totalSecs % 60;
		const mm = String(m).padStart(2, '0');
		const ss = String(s).padStart(2, '0');
		return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
	}

	$effect(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 500);
		return () => clearInterval(interval);
	});
</script>

<div class="app-countdown-to-jam">
	<span class="app-countdown-to-jam__label">{title}</span>
	<span class="app-countdown-to-jam__time">
		{msRemaining !== null ? formatCountdown(msRemaining) : '--:--'}
	</span>
</div>

<style>
	.app-countdown-to-jam {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		background: var(--color-broadcast-bg, #08090b);
		color: #f0f0f0;
		font-family: 'Schibsted Grotesk', sans-serif;
		gap: 1.5rem;
	}

	.app-countdown-to-jam__label {
		font-size: clamp(0.875rem, 2vw, 1.25rem);
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: #1ac0d7;
		font-weight: 500;
	}

	.app-countdown-to-jam__time {
		font-size: clamp(5rem, 18vw, 14rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: #f0f0f0;
	}
</style>