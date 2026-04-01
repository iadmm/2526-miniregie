<script lang="ts">
	import type { MediaItem, NoteContent } from '@shared/types';

	interface Props { item: MediaItem }
	let { item }: Props = $props();

	const content = $derived(item.content as NoteContent);
</script>

{#key item.id}
	<div class="c-note-slot">
		<article class="c-note-card">
			<p class="c-note-card__eyebrow">Note</p>
			<blockquote class="c-note-card__text">{content.text}</blockquote>
			<div class="c-note-card__attribution">
				<span class="c-note-card__author">{item.author.displayName}</span>
				{#if item.author.team}
					<span class="c-note-card__team">{item.author.team}</span>
				{/if}
			</div>
		</article>
	</div>
{/key}

<style>
	/* Container query context — cqw resolves against this slot's width.
	 * Scoped font tokens here so cqw values are valid (not available in :root). */
	.c-note-slot {
		position: relative;
		width: 100%;
		height: 100%;
		container-type: inline-size;

		--note-fz-eyebrow: clamp(7px,  0.75cqw, 12px);
		--note-fz-body:    clamp(13px, 1.55cqw, 28px);
		--note-fz-author:  clamp(10px, 1.05cqw, 20px);
		--note-fz-team:    clamp(6px,  0.65cqw, 10px);
	}

	/* White editorial card — centered above geometric center (Tschichold) */
	.c-note-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -54%);
		max-width: 76%;
		max-height: 82%;
		overflow: hidden;
		background: var(--color-surface, #f8f7f5);
		padding: clamp(20px, 3.2vw, 40px) clamp(24px, 3.8vw, 48px);
	}

	/* Eyebrow — "Note", ghost label above the body */
	.c-note-card__eyebrow {
		font-family: var(--font-editorial, 'Schibsted Grotesk', sans-serif);
		font-size: var(--note-fz-eyebrow);
		font-weight: 400;
		color: rgba(0, 0, 0, 0.50);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin-bottom: clamp(10px, 1.4cqw, 16px);
		animation: note-eyebrow-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* Body text — primary voice of the participant.
	 * cqw resolves against .c-note-slot width → adapts in narrow companion slots. */
	.c-note-card__text {
		font-family: var(--font-editorial, 'Schibsted Grotesk', sans-serif);
		font-size: var(--note-fz-body);
		font-weight: 400;
		font-style: normal;
		color: rgba(0, 0, 0, 0.88);
		line-height: 1.5;
		letter-spacing: -0.01em;
		margin: 0;
		padding: 0;
		quotes: none;
		animation: note-text-in 560ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both;
	}

	/* Attribution block — author + team, after the body */
	.c-note-card__attribution {
		display: flex;
		flex-direction: column;
		gap: clamp(2px, 0.3cqw, 4px);
		margin-top: clamp(12px, 1.8cqw, 22px);
		animation: note-attr-in 400ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both;
	}

	/* Author name — Fraunces 300, the only serif in the note card */
	.c-note-card__author {
		display: block;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: var(--note-fz-author);
		font-weight: 300;
		font-style: normal;
		color: rgba(0, 0, 0, 0.70);
		letter-spacing: 0.01em;
		line-height: 1;
	}

	/* Team — secondary metadata */
	.c-note-card__team {
		display: block;
		font-family: var(--font-editorial, 'Schibsted Grotesk', sans-serif);
		font-size: var(--note-fz-team);
		font-weight: 400;
		color: rgba(0, 0, 0, 0.52);
		letter-spacing: 0.10em;
		text-transform: uppercase;
		line-height: 1;
	}

	/* ── Keyframes ────────────────────────────────────────────── */

	@keyframes note-eyebrow-in {
		from { opacity: 0; transform: translateY(4px); }
		to   { opacity: 1; transform: translateY(0);   }
	}

	@keyframes note-text-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0);    }
	}

	@keyframes note-attr-in {
		from { opacity: 0; transform: translateY(7px); }
		to   { opacity: 1; transform: translateY(0);   }
	}
</style>
