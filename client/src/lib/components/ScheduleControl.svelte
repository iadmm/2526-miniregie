<script lang="ts">
	import { onMount } from 'svelte';
	import type { ScheduleEntry } from '@shared/types';
	import { buildAt, type AtType } from '$lib/schedule-utils';
	import { serverState } from '$lib/server-state.svelte';
	import ScheduleRow from './ScheduleRow.svelte';
	import ScheduleForm from './ScheduleForm.svelte';

	let entries = $state<ScheduleEntry[]>([]);
	let showAdd = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);

	let addAtType = $state<AtType>('H+');
	let addAtValue = $state('');
	let addApp = $state('jam-mode');
	let addLabel = $state('');

	const jam = $derived(serverState.state?.jam ?? null);

	async function fetchEntries() {
		try {
			const res = await fetch('/api/schedule');
			if (res.ok) {
				entries = (await res.json()) as ScheduleEntry[];
			} else {
				error = ((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`;
			}
		} catch (e) {
			error = String(e);
		}
	}

	onMount(fetchEntries);

	async function api(method: string, path: string, body?: unknown): Promise<boolean> {
		busy = true;
		error = null;
		try {
			const res = await fetch(path, {
				method,
				headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
				body: body !== undefined ? JSON.stringify(body) : undefined,
			});
			if (!res.ok) {
				error = ((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`;
				return false;
			}
			return true;
		} catch (e) {
			error = String(e);
			return false;
		} finally {
			busy = false;
		}
	}

	async function handleSave(id: number, patch: { at: string; app: string; label: string | null }): Promise<boolean> {
		const ok = await api('PUT', `/api/schedule/${id}`, patch);
		if (ok) await fetchEntries();
		return ok;
	}

	async function handleFire(entry: ScheduleEntry) {
		const ok = await api('POST', '/api/broadcast/dispatch', { appId: entry.app });
		if (ok) {
			await api('PUT', `/api/schedule/${entry.id}`, { status: 'fired' });
			await fetchEntries();
		}
	}

	async function handleDelete(id: number) {
		if (!confirm('Delete this schedule entry?')) return;
		const ok = await api('DELETE', `/api/schedule/${id}`);
		if (ok) await fetchEntries();
	}

	async function handleAdd() {
		const ok = await api('POST', '/api/schedule', {
			at: buildAt(addAtType, addAtValue),
			app: addApp,
			label: addLabel || undefined,
		});
		if (ok) {
			await fetchEntries();
			addAtValue = '';
			addLabel = '';
			showAdd = false;
		}
	}
</script>

<section class="c-admin__section">
	<p class="c-admin__label">Schedule</p>

	{#if entries.length > 0}
		<table class="c-schedule">
			<thead>
				<tr>
					<th aria-label="Status"></th>
					<th>Trigger</th>
					<th>App</th>
					<th>Label</th>
					<th aria-label="Actions"></th>
				</tr>
			</thead>
			<tbody>
				{#each entries as entry (entry.id)}
					<ScheduleRow
						{entry}
						{jam}
						{busy}
						onfire={() => handleFire(entry)}
						onsave={(patch) => handleSave(entry.id, patch)}
						ondelete={() => handleDelete(entry.id)}
					/>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="c-schedule__empty">No entries yet.</p>
	{/if}

	{#if showAdd}
		<div class="c-schedule__add-form">
			<ScheduleForm
				bind:atType={addAtType}
				bind:atValue={addAtValue}
				bind:app={addApp}
				bind:label={addLabel}
				disabled={busy}
			/>
			<div class="c-schedule__add-actions">
				<button
					class="c-btn c-schedule__btn"
					onclick={handleAdd}
					disabled={busy || addAtValue.trim().length === 0}
				>Add</button>
				<button
					class="c-btn c-schedule__btn c-schedule__btn--ghost"
					onclick={() => (showAdd = false)}
					disabled={busy}
				>Cancel</button>
			</div>
		</div>
	{:else}
		<button
			class="c-btn c-schedule__btn c-schedule__btn--ghost c-schedule__add-btn"
			onclick={() => (showAdd = true)}
		>+ Add entry</button>
	{/if}

	{#if error}
		<p class="c-admin__error">{error}</p>
	{/if}
</section>