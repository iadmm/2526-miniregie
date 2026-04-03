<script lang="ts">
	import { apiFetch } from '$lib/api';
	import { serverState } from '$lib/server-state.svelte';
	import { KNOWN_APPS } from '@shared/types';

	const jam = $derived(serverState.state?.jam ?? null);
	const broadcast = $derived(serverState.state?.broadcast ?? null);

	let busy = $state(false);
	let error = $state<string | null>(null);

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

	async function resumeTo(appId: string) {
		await del('/api/jam/panic', { resumeAppId: appId });
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

		<button
			class="c-btn"
			disabled={busy}
			onclick={() => confirm('Reload all broadcast clients?') && post('/api/broadcast/reload')}
		>
			Reload clients
		</button>

		{#if !broadcast?.panicState}
			<button
				class="c-btn c-btn--danger"
				disabled={busy}
				onclick={() => post('/api/jam/panic')}
			>
				Panic
			</button>
		{:else}
			<div class="panic-resume">
				<span class="panic-resume__label">Switch to →</span>
				{#each KNOWN_APPS as appId}
					<button
						class="c-btn c-btn--sm"
						class:c-btn--active={broadcast?.activeApp === appId}
						disabled={busy}
						onclick={() => resumeTo(appId)}
					>
						{appId}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}
		<p class="c-admin__error">{error}</p>
	{/if}
</section>

<style>
	.panic-resume {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		border-radius: 4px;
	}

	.panic-resume__label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.6;
		margin-right: 0.25rem;
	}
</style>