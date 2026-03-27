<script lang="ts">
	import { KNOWN_APPS, type AtType } from '$lib/schedule-utils';

	let {
		atType = $bindable<AtType>('H+'),
		atValue = $bindable(''),
		app = $bindable<string>('jam-mode'),
		label = $bindable(''),
		disabled = false,
	} = $props();
</script>

<div class="c-schedule-form">
	<select class="c-schedule-form__select" bind:value={atType} {disabled}>
		<option value="H+">H+</option>
		<option value="T-">T−</option>
		<option value="absolute">abs</option>
	</select>

	{#if atType === 'absolute'}
		<input class="c-schedule-form__input" type="datetime-local" bind:value={atValue} {disabled} />
	{:else}
		<input
			class="c-schedule-form__input c-schedule-form__input--short"
			type="text"
			bind:value={atValue}
			placeholder="HH:MM:SS"
			{disabled}
		/>
	{/if}

	<select class="c-schedule-form__select c-schedule-form__select--app" bind:value={app} {disabled}>
		{#each KNOWN_APPS as a}
			<option value={a}>{a}</option>
		{/each}
	</select>

	<input
		class="c-schedule-form__input"
		type="text"
		bind:value={label}
		placeholder="label (opt.)"
		{disabled}
	/>
</div>