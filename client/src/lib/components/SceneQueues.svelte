<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';
	import { poolItems, contentPreview, formatSubmittedAt } from '$lib/pool-items.svelte';
	import type { LoudSlot, SilentSlot, MediaItem } from '@shared/types';

	const scene = $derived(serverState.scene);

	// Active scene item IDs (for cross-referencing)
	const activeIds = $derived((): string[] => {
		const ids: string[] = [];
		if (scene?.loud?.kind === 'loud') ids.push((scene.loud as LoudSlot).item.id);
		for (const s of scene?.silents ?? []) ids.push(s.item.id);
		return ids;
	});

	// Pending queues — status='ready', not in active scene
	const pendingLoud = $derived(
		poolItems.items.filter(
			(i: MediaItem) => ['youtube', 'clip'].includes(i.type) && i.status === 'ready' && !activeIds().includes(i.id),
		),
	);
	const pendingVisual = $derived(
		poolItems.items.filter(
			(i: MediaItem) => ['photo', 'gif'].includes(i.type) && i.status === 'ready' && !activeIds().includes(i.id),
		),
	);
	const pendingNote = $derived(
		poolItems.items.filter(
			(i: MediaItem) => i.type === 'note' && i.status === 'ready' && !activeIds().includes(i.id),
		),
	);

	function loudLabel(slot: LoudSlot): string {
		const c = slot.item.content as unknown as Record<string, unknown>;
		const title = typeof c['title'] === 'string' ? c['title'] : slot.item.id.slice(0, 8);
		const remaining = Math.max(0, Math.round((slot.maxEndsAt - Date.now()) / 1000));
		return `${slot.item.type.toUpperCase()} — ${title} (max ${remaining}s)`;
	}

	function silentLabel(slot: SilentSlot): string {
		const remaining = Math.max(0, Math.round((slot.endsAt - Date.now()) / 1000));
		return `${slot.item.type.toUpperCase()} — ${contentPreview(slot.item)} (${remaining}s)`;
	}

	async function forceReset() {
		await fetch('/api/scene/reset', { method: 'POST' });
	}
</script>

<section class="c-admin__section">
	<div class="c-scene-queues__header">
		<p class="c-admin__label">Scene — {scene?.layout ?? 'IDLE'}</p>
		<button onclick={forceReset}>Force reset</button>
	</div>

	{#if scene?.loud}
		<div class="c-scene-queues__row c-scene-queues__row--active">
			<span class="c-scene-queues__type">{scene.loud.kind === 'filler' ? 'filler' : scene.loud.kind}</span>
			<span class="c-scene-queues__label">
				{scene.loud.kind === 'filler' ? '[ filler ]' : loudLabel(scene.loud as LoudSlot)}
			</span>
		</div>
	{/if}
	{#each scene?.silents ?? [] as silent}
		<div class="c-scene-queues__row c-scene-queues__row--active">
			<span class="c-scene-queues__type">{silent.item.type}</span>
			<span class="c-scene-queues__label">{silentLabel(silent)}</span>
		</div>
	{/each}

	<div class="c-scene-queues__queues">
		{#each [
			{ label: `Loud (${pendingLoud.length})`, items: pendingLoud },
			{ label: `Visual (${pendingVisual.length})`, items: pendingVisual },
			{ label: `Note (${pendingNote.length})`, items: pendingNote },
		] as queue}
			<div>
				<p class="c-scene-queues__queue-label">{queue.label}</p>
				{#each queue.items as item (item.id)}
					<div class="c-scene-queues__row c-scene-queues__row--pending">
						<span class="c-scene-queues__type">{item.type}</span>
						<span class="c-scene-queues__label">{contentPreview(item)}</span>
						<span class="c-scene-queues__meta">{formatSubmittedAt(item.submittedAt)}</span>
					</div>
				{/each}
				{#if queue.items.length === 0}
					<div class="c-scene-queues__row">
						<span class="c-scene-queues__label">—</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
