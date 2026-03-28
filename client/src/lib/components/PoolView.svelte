<script lang="ts">
	import { serverState } from '$lib/server-state.svelte';
	import { poolItems, fetchPoolItems, contentPreview, formatSubmittedAt } from '$lib/pool-items.svelte';

	const pool = $derived(serverState.state?.pool ?? null);
	const activeItemIds = $derived(serverState.state?.broadcast?.activeItemIds ?? []);

	$effect(() => {
		void pool?.total;
		void fetchPoolItems();
	});
</script>

<section class="c-admin__section">
	<p class="c-admin__label">
		Pool — {poolItems.items.length} items
		{#if poolItems.loading}<span class="c-pool__loading">loading…</span>{/if}
	</p>

	{#if poolItems.error}
		<p class="c-admin__error">{poolItems.error}</p>
	{/if}

	{#if poolItems.items.length === 0 && !poolItems.loading}
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
					<th>Time</th>
				</tr>
			</thead>
			<tbody>
				{#each poolItems.items as item (item.id)}
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
						<td class="c-pool__time">{formatSubmittedAt(item.submittedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>