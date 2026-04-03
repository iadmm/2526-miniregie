<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';

const connected = $derived(serverState.connected);
	const jam = $derived(serverState.state?.jam ?? null);
	const broadcast = $derived(serverState.state?.broadcast ?? null);
	const pool = $derived(serverState.state?.pool ?? null);

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(id);
	});

	function formatTime(ts: number | null): string {
		if (!ts) return '—';
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function formatCountdown(ms: number): string {
		if (ms <= 0) return '00m 00s';
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		return h > 0
			? `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
			: `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
	}

	const currentTime = $derived(formatTime(now));
	const endsAt = $derived(jam?.endsAt ?? null);
	const timeRemaining = $derived(endsAt !== null ? Math.max(0, endsAt - now) : null);
</script>

<section class="c-admin__section">
	<p class="c-admin__label">Server</p>
	<dl class="c-admin__dl">
		<dt>Connection</dt>
		<dd>{connected ? 'connected' : 'disconnected'}</dd>

		{#if broadcast}
			<dt>Active app</dt>
			<dd>{broadcast.activeApp}</dd>

			<dt>Transition</dt>
			<dd>{broadcast.transition}</dd>

			{#if broadcast.panicState}
				<dt>Panic</dt>
				<dd>ACTIVE — {broadcast.panicMessage || 'no message'}</dd>
			{/if}
		{/if}

		<dt>Time</dt>
		<dd>{currentTime}</dd>

		{#if jam}
			<dt>JAM</dt>
			<dd>{jam.status}</dd>

			{#if endsAt !== null}
				<dt>Ends at</dt>
				<dd>{formatTime(endsAt)}</dd>

				{#if jam.status === 'running' && timeRemaining !== null}
					<dt>Remaining</dt>
					<dd>{formatCountdown(timeRemaining)}</dd>
				{/if}
			{/if}
		{/if}

		{#if pool}
			<dt>Pool</dt>
			<dd>{pool.total} ready</dd>
		{/if}
	</dl>

	<form method="POST" action="?/logout">
		<button class="c-btn c-btn--ghost" type="submit">Logout</button>
	</form>
</section>