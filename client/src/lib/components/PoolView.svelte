<script lang="ts">
	import type { MediaItem } from '@shared/types';
	import { serverState } from '$lib/server-state.svelte';
	import { contentPreview, formatSubmittedAt, formatAR } from '$lib/pool-items.svelte';

	interface Props { poolItems?: MediaItem[] }
	let { poolItems = [] }: Props = $props();

	const activeItemIds = $derived(serverState.state?.broadcast?.activeItemIds ?? []);
</script>

<section class="c-admin__section">
	<p class="c-admin__label">
		Pool — {poolItems.length} items
	</p>

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
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>