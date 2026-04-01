<script lang="ts">
	interface Props {
		visible:      boolean;
		label:        string;
		name:         string;
		caption?:     string;
		submittedAt?: number;
	}

	let { visible, label, name, caption, submittedAt }: Props = $props();

	// HH:MM format for submission time
	const timeStr = $derived.by(() => {
		if (!submittedAt) return '';
		return new Date(submittedAt).toLocaleTimeString('fr-BE', {
			hour: '2-digit', minute: '2-digit', hour12: false,
		});
	});
</script>

<!--
  SlotChyron — source tag for companion visual slots.
  Lives inside the visual slot (position: absolute, bottom-left, 5% inset).
  Two-part horizontal tag:
    [PHOTO] [légende  /  auteur · heure]
  Stays visible during companion intro only; after the visual slides to its
  companion position the attribution has already been seen.
  Entry: clip-path wipe, flag 160ms then bloc 260ms, power2.out.
-->
<div class="c-slot-chyron" class:c-slot-chyron--visible={visible} aria-live="polite">
	<div class="c-slot-chyron__flag">
		<span>{label}</span>
	</div>
	<div class="c-slot-chyron__bloc">
		{#if caption}
			<span class="c-slot-chyron__caption">{caption}</span>
			<span class="c-slot-chyron__meta">{name}</span>
		{:else}
			<span class="c-slot-chyron__name">{name}</span>
			{#if timeStr}
				<span class="c-slot-chyron__meta">{timeStr}</span>
			{/if}
		{/if}
	</div>
</div>

<style>
	.c-slot-chyron {
		position: absolute;
		left: 5%;
		bottom: 5%;
		z-index: 10;
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 1px;
	}

	/* ── Cyan flag ──────────────────────────────────────────────────── */

	.c-slot-chyron__flag {
		background: var(--color-brand, #1ac0d7);
		padding: clamp(2px, 0.28vw, 3px) clamp(4px, 0.55vw, 6px);
		/* Default: hidden. Exit: power2.in 120ms */
		clip-path: inset(0 100% 0 0);
		transition: clip-path 120ms cubic-bezier(0.4, 0, 1, 0);
	}

	.c-slot-chyron__flag span {
		display: block;
		font-family: var(--font-editorial, 'Schibsted Grotesk', sans-serif);
		font-size: clamp(5px, 0.68vw, 7.5px);
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(0, 0, 0, 0.68);
		line-height: 1;
		white-space: nowrap;
	}

	/* ── White bloc — main content ─────────────────────────────────── */

	.c-slot-chyron__bloc {
		background: var(--color-surface, #f8f7f5);
		padding: clamp(2px, 0.28vw, 3px) clamp(5px, 0.7vw, 8px);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		/* Default: hidden. Exit: power2.in 120ms */
		clip-path: inset(0 100% 0 0);
		transition: clip-path 120ms cubic-bezier(0.4, 0, 1, 0);
	}

	/* Caption or author name — Fraunces 400 */
	.c-slot-chyron__caption,
	.c-slot-chyron__name {
		display: block;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: clamp(7px, 0.82vw, 9px);
		font-weight: 400;
		font-style: normal;
		color: #0a0a0a;
		line-height: 1;
		white-space: nowrap;
	}

	/* Secondary line: author (when caption shown) or time */
	.c-slot-chyron__meta {
		display: block;
		font-family: var(--font-editorial, 'Schibsted Grotesk', sans-serif);
		font-size: clamp(4.5px, 0.56vw, 6.5px);
		font-weight: 400;
		color: rgba(10, 10, 10, 0.52);
		line-height: 1;
		white-space: nowrap;
		letter-spacing: 0.04em;
	}

	/* ── Visible state — entry wipes ────────────────────────────────── */

	/* Flag arrives first: 160ms power2.out, no delay */
	.c-slot-chyron--visible .c-slot-chyron__flag {
		clip-path: inset(0 0% 0 0);
		transition: clip-path 160ms cubic-bezier(0, 0, 0.4, 1) 0ms;
	}

	/* Bloc arrives second: 260ms power2.out, 100ms delay */
	.c-slot-chyron--visible .c-slot-chyron__bloc {
		clip-path: inset(0 0% 0 0);
		transition: clip-path 260ms cubic-bezier(0, 0, 0.4, 1) 100ms;
	}
</style>
