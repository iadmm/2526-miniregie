<script lang="ts">
	import { broadcastLog, clearLog } from '$lib/broadcast-log.svelte';

	function formatTs(ts: number): string {
		return new Date(ts).toLocaleTimeString([], {
			hour:   '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
	}
</script>

<section class="c-admin__section">
	<div class="header">
		<span class="c-admin__label">Broadcast events</span>
		{#if broadcastLog.entries.length > 0}
			<button class="clear-btn" onclick={clearLog}>clear</button>
		{/if}
	</div>

	{#if broadcastLog.entries.length === 0}
		<p class="empty">— no events —</p>
	{:else}
		<ol class="log">
			{#each broadcastLog.entries as entry (entry.id)}
				<li class="row" data-kind={entry.kind}>
					<span class="ts">{formatTs(entry.ts)}</span>
					<span class="event">{entry.event}</span>
					{#if entry.summary}
						<span class="summary">{entry.summary}</span>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.clear-btn {
		font-size: 0.75rem;
		opacity: 0.4;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
	}

	.clear-btn:hover { opacity: 0.9; }

	.empty {
		opacity: 0.35;
		font-size: 0.82rem;
		margin-block-start: var(--space-xs);
	}

	.log {
		list-style: none;
		padding: 0;
		margin-block-start: var(--space-xs);
		max-height: 260px;
		overflow-y: auto;
		border-top: 1px solid currentColor;
		opacity: 0.9;
	}

	.row {
		display: grid;
		grid-template-columns: 6rem 7.5rem 1fr;
		align-items: baseline;
		gap: 0 0.75rem;
		padding-block: 0.28rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.07);
		font-size: 0.8rem;
	}

	.ts {
		font-family: monospace;
		font-size: 0.72rem;
		opacity: 0.38;
		white-space: nowrap;
	}

	.event {
		font-family: monospace;
		font-size: 0.78rem;
		opacity: 0.7;
	}

	.row[data-kind='show'] .event  { color: #1ac0d7; opacity: 1; }
	.row[data-kind='hide'] .event  { opacity: 0.38; }
	.row[data-kind='warn'] .event  { color: #e06c5a; opacity: 1; }

	.summary {
		font-size: 0.78rem;
		opacity: 0.55;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row[data-kind='show'] .summary { opacity: 0.75; }
</style>
