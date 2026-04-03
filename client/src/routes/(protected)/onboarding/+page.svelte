<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();

	let avatarPreview = $state('');
	let busy = $state(false);
	let fileName = $state('');

	function handleFilePick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		avatarPreview = file ? URL.createObjectURL(file) : '';
		fileName = file?.name ?? '';
	}

	const firstName = $derived(data.participant?.displayName?.split(' ')[0] ?? '');
</script>

<div class="c-login-page">
	<main class="c-login-card">
		<div class="c-login-card__brand">
			<span class="c-login-card__logo">M4TV</span>
			<form method="POST" action="?/logout">
				<button type="submit" class="c-onboarding__signout">Se déconnecter</button>
			</form>
		</div>

		<div class="c-onboarding__greeting">
			<h1 class="c-onboarding__welcome">
				Bienvenue,<br><em class="c-onboarding__name">{firstName}.</em>
			</h1>
			<p class="c-onboarding__hint">Ajoute une photo de profil — ton visage apparaîtra à l'écran.</p>
		</div>

		<form
			class="c-login-card__form"
			method="POST"
			action="?/avatar"
			enctype="multipart/form-data"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update();
				};
			}}
		>
			{#if form?.error}
				<p class="c-login-card__error" role="alert">{form.error}</p>
			{/if}

			<div class="c-field">
				<label class="c-field__label" for="avatar-file">Photo de profil</label>
				<div class="c-avatar-upload">
					{#if avatarPreview}
						<img class="c-avatar-upload__preview" src={avatarPreview} alt="Aperçu" />
					{:else}
						<div class="c-avatar-upload__placeholder" aria-hidden="true">
							<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<circle cx="12" cy="8" r="4"/>
								<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
							</svg>
						</div>
					{/if}
					<div class="c-avatar-upload__controls">
						<label class="c-avatar-upload__pick" for="avatar-file">
							{fileName || 'Choisir un fichier…'}
						</label>
						<input
							class="c-avatar-upload__input"
							id="avatar-file"
							name="avatar"
							type="file"
							accept="image/jpeg,image/png,image/webp"
							onchange={handleFilePick}
							required
						/>
						<span class="c-field__hint">JPEG, PNG ou WebP — 5 Mo max</span>
					</div>
				</div>
			</div>

			<button class="c-login-card__submit" type="submit" disabled={busy}>
				{busy ? 'Envoi en cours…' : 'Enregistrer et continuer'}
			</button>
		</form>
	</main>
</div>
