<script lang="ts">
	import { apiFetch } from '$lib/api';
	import { serverState } from '$lib/server-state.svelte';

	const jam = $derived(serverState.state?.jam ?? null);
	const broadcast = $derived(serverState.state?.broadcast ?? null);

	let busy = $state(false);
	let error = $state<string | null>(null);
	let resumeAppId = $state('pre-jam-idle');

	async function post(path: string, body?: unknown) {
		busy = true;
		error = null;
		const result = await apiFetch('POST', path, body);
		error = result.error;
		busy = false;
	}

	async function del(path: string, body?: unknown) {
		busy = true;
		error = null;
		const result = await apiFetch('DELETE', path, body);
		error = result.error;
		busy = false;
	}
</script>

<section class="c-admin__section">
	<p class="c-admin__label">JAM control</p>

	<div class="c-admin__controls">
		<button
			class="c-btn"
			disabled={busy || jam?.status === 'running' || jam?.status === 'ended'}
			onclick={() => post('/api/jam/start')}
		>
			Start JAM
		</button>

		<button
			class="c-btn"
			disabled={busy || jam?.status !== 'running'}
			onclick={() => post('/api/jam/end')}
		>
			End JAM
		</button>

		<button
			class="c-btn"
			disabled={busy}
			onclick={() => confirm('Reset all media and JAM state?') && post('/api/jam/reset')}
		>
			Reset
		</button>

		{#if !broadcast?.panicState}
			<button
				class="c-btn"
				disabled={busy}
				onclick={() => post('/api/jam/panic')}
			>
				Panic
			</button>
		{:else}
			<input bind:value={resumeAppId} placeholder="resume app id" disabled={busy} />
			<button
				class="c-btn"
				disabled={busy || resumeAppId.trim().length === 0}
				onclick={() => del('/api/jam/panic', { resumeAppId: resumeAppId.trim() })}
			>
				Clear panic
			</button>
		{/if}
	</div>

	{#if error}
		<p class="c-admin__error">{error}</p>
	{/if}
</section>