<script lang="ts">
	import type { MediaItem } from '@shared/types';
	import { serverState } from '$lib/server-state.svelte';
	import { contentPreview, formatSubmittedAt, formatAR } from '$lib/pool-items.svelte';
	import { apiFetch } from '$lib/api';
	import { invalidateAll } from '$app/navigation';

	interface Props { poolItems?: MediaItem[] }
	let { poolItems = [] }: Props = $props();

	const activeItemIds = $derived(serverState.state?.broadcast?.activeItemIds ?? []);

	let flashMessage = $state<string | null>(null);
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	async function deleteItem(item: MediaItem) {
		const { ok } = await apiFetch('DELETE', `/api/items/${item.id}`);
		if (!ok) return;

		await invalidateAll();

		flashMessage = `"${item.author.displayName}" item deleted`;
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => { flashMessage = null; }, 3000);
	}
</script>

<section class="c-admin__section">
	<p class="c-admin__label">
		Pool — {poolItems.length} items
	</p>

	{#if flashMessage}
		<p class="c-message c-message--success">{flashMessage}</p>
	{/if}

	{#if poolItems.length === 0}
		<p class="c-pool__empty">Pool is empty</p>
	{:else}
		<table class="c-pool__table">
			<thead>
				<tr>
					<th>#</th>
					<th>Status</th>
					<th>Type</th>
					<th>Author</th>
					<th class="c-pool__col-preview">Content</th>
					<th>AR</th>
					<th>Time</th>
				</tr>
			</thead>
			<tbody>
				{#each poolItems as item (item.id)}
					<tr
						class="c-pool__row"
						data-status={item.status}
						data-active={activeItemIds.includes(item.id) || undefined}
					>
						<td class="c-pool__pos">{item.queuePosition ?? '—'}</td>
						<td class="c-pool__status">{item.status}</td>
						<td class="c-pool__type">{item.type}</td>
						<td class="c-pool__author">{item.author.displayName}</td>
						<td class="c-pool__preview">{contentPreview(item)}</td>
						<td class="c-pool__ar">{formatAR(item)}</td>
						<td class="c-pool__time">{formatSubmittedAt(item.submittedAt)}</td>
						<td class="c-pool__actions"><button onclick={() => deleteItem(item)}>Delete</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>