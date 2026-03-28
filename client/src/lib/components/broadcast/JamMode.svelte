<script lang="ts">
	import { serverState, getSocket } from '$lib/server-state.svelte';
	import type { LoudSlot, SilentSlot } from '@shared/types';

	const scene = $derived(serverState.scene);

	function onLoudEnded(itemId: string) {
		getSocket()?.emit('scene:loud:ended', { itemId });
	}
</script>

<div class="app-jam-mode">
	{#if !scene}
		<p>Waiting for scene…</p>
	{:else}
		<div class="scene-debug">
			<div class="scene-layout">Layout: <strong>{scene.layout}</strong></div>

			<div class="scene-slot scene-slot--loud">
				<span class="slot-label">LOUD</span>
				{#if scene.loud?.kind === 'loud'}
					{@const s = scene.loud as LoudSlot}
					<span class="slot-content">{s.item.type.toUpperCase()} — {s.item.id.slice(0, 8)}</span>
					<button onclick={() => onLoudEnded(s.item.id)}>Simulate end</button>
				{:else if scene.loud?.kind === 'filler'}
					<span class="slot-content">[ FILLER ]</span>
				{:else}
					<span class="slot-content">—</span>
				{/if}
			</div>

			{#each scene.silents as silent (silent.item.id)}
				{@const s = silent as SilentSlot}
				<div class="scene-slot scene-slot--silent">
					<span class="slot-label">SILENT</span>
					<span class="slot-content">{s.item.type.toUpperCase()} — {s.item.id.slice(0, 8)}</span>
				</div>
			{/each}

			{#if scene.silents.length === 0 && !scene.loud}
				<div class="scene-slot scene-slot--idle">IDLE — pool empty</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.app-jam-mode {
		padding: 1rem;
		font-family: monospace;
		background: #08090b;
		color: #e0e0e0;
		min-height: 100vh;
	}

	.scene-debug {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.scene-layout {
		font-size: 1.2rem;
		margin-bottom: 0.5rem;
		color: #1ac0d7;
	}

	.scene-slot {
		padding: 0.5rem 0.75rem;
		border: 1px solid #333;
		border-radius: 4px;
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.scene-slot--loud { border-color: #e06c00; }
	.scene-slot--silent { border-color: #1ac0d7; }
	.scene-slot--idle { border-color: #444; color: #666; }

	.slot-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		opacity: 0.6;
		min-width: 4rem;
	}

	.slot-content { flex: 1; }
</style>