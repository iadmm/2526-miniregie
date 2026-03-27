<script lang="ts">
	import type { ScheduleEntry } from '@shared/types';
	import { parseAt, buildAt, resolveAt, type AtType } from '$lib/schedule-utils';
	import ScheduleForm from './ScheduleForm.svelte';

	interface Patch { at: string; app: string; label: string | null }

	let {
		entry,
		jam,
		busy,
		onfire,
		onsave,
		ondelete,
	}: {
		entry: ScheduleEntry;
		jam: { startedAt: number | null; endsAt: number | null } | null;
		busy: boolean;
		onfire: () => void;
		onsave: (patch: Patch) => Promise<boolean>;
		ondelete: () => void;
	} = $props();

	let isEditing = $state(false);
	let editAtType = $state<AtType>('H+');
	let editAtValue = $state('');
	let editApp = $state(entry.app);
	let editLabel = $state(entry.label ?? '');

	function startEdit() {
		const parsed = parseAt(entry.at);
		editAtType = parsed.type;
		editAtValue =
			parsed.type === 'absolute'
				? new Date(parsed.value).toISOString().slice(0, 16)
				: parsed.value;
		editApp = entry.app;
		editLabel = entry.label ?? '';
		isEditing = true;
	}

	async function handleSave() {
		const ok = await onsave({ at: buildAt(editAtType, editAtValue), app: editApp, label: editLabel || null });
		if (ok) isEditing = false;
	}

	const resolved = $derived(resolveAt(entry.at, jam));
</script>

{#if isEditing}
	<tr class="c-schedule__row c-schedule__row--editing">
		<td></td>
		<td colspan="3">
			<ScheduleForm
				bind:atType={editAtType}
				bind:atValue={editAtValue}
				bind:app={editApp}
				bind:label={editLabel}
				disabled={busy}
			/>
		</td>
		<td class="c-schedule__actions">
			<button
				class="c-btn c-schedule__btn"
				onclick={handleSave}
				disabled={busy || editAtValue.trim().length === 0}
			>Save</button>
			<button
				class="c-btn c-schedule__btn c-schedule__btn--ghost"
				onclick={() => (isEditing = false)}
				disabled={busy}
			>Cancel</button>
		</td>
	</tr>
{:else}
	<tr class="c-schedule__row" data-status={entry.status}>
		<td><span class="c-schedule__dot" title={entry.status}></span></td>
		<td class="c-schedule__trigger">
			<span class="c-schedule__at">{entry.at}</span>
			{#if resolved}<span class="c-schedule__resolved">→ {resolved}</span>{/if}
		</td>
		<td class="c-schedule__app">{entry.app}</td>
		<td class="c-schedule__label-cell">{entry.label ?? '—'}</td>
		<td class="c-schedule__actions">
			{#if entry.status === 'pending'}
				<button class="c-btn c-schedule__btn" onclick={onfire} disabled={busy} title="Fire now">▶</button>
			{/if}
			<button class="c-btn c-schedule__btn c-schedule__btn--ghost" onclick={startEdit} disabled={busy} title="Edit">✎</button>
			<button class="c-btn c-schedule__btn c-schedule__btn--ghost c-schedule__btn--danger" onclick={ondelete} disabled={busy} title="Delete">✕</button>
		</td>
	</tr>
{/if}