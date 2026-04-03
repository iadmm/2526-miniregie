<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	type FormResult = { action?: string; error?: string } | null;
	let { form }: { form: FormResult } = $props();

	let tab = $state<'signin' | 'register'>('signin');

	$effect(() => {
		const q = $page.url.searchParams.get('tab');
		if (q === 'register') tab = 'register';
	});

	let loading = $state(false);
</script>

<div class="c-login-page">
	<main class="c-login-card">
		<div class="c-login-card__brand">
			<span class="c-login-card__logo">M4TV</span>
		</div>
		<div class="c-login-card__tabs" role="tablist">
			<button
				class="c-login-card__tab"
				class:c-login-card__tab--active={tab === 'signin'}
				role="tab"
				aria-selected={tab === 'signin'}
				type="button"
				onclick={() => { tab = 'signin'; }}
			>Sign in</button>
			<button
				class="c-login-card__tab"
				class:c-login-card__tab--active={tab === 'register'}
				role="tab"
				aria-selected={tab === 'register'}
				type="button"
				onclick={() => { tab = 'register'; }}
			>Register</button>
		</div>

		{#if tab === 'signin'}
			<form
				class="c-login-card__form"
				method="POST"
				action="?/signin"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
			>
				{#if form?.error && form?.action === 'signin'}
					<p class="c-login-card__error" role="alert">{form.error}</p>
				{/if}

				<div class="c-field">
					<label class="c-field__label" for="signin-username">Username</label>
					<input
						class="c-field__input"
						id="signin-username"
						name="username"
						type="text"
						autocomplete="username"
						autocapitalize="off"
						spellcheck="false"
						required
					/>
				</div>

				<div class="c-field">
					<label class="c-field__label" for="signin-password">Password</label>
					<input
						class="c-field__input"
						id="signin-password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>

				<button class="c-login-card__submit" type="submit" disabled={loading}>
					{loading ? 'Signing in…' : 'Sign in'}
				</button>
			</form>

			<p class="c-login-card__switch">
				No account yet?
				<button type="button" class="c-login-card__switch-link" onclick={() => { tab = 'register'; }}>
					Register here
				</button>
			</p>

		{:else}
			<form
				class="c-login-card__form"
				method="POST"
				action="?/register"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
			>
				{#if form?.error && form?.action === 'register'}
					<p class="c-login-card__error" role="alert">{form.error}</p>
				{/if}

				<div class="c-field">
					<label class="c-field__label" for="reg-displayName">Display name</label>
					<input
						class="c-field__input"
						id="reg-displayName"
						name="displayName"
						type="text"
						autocomplete="name"
						placeholder="How you'll appear on screen"
						required
					/>
				</div>

				<div class="c-login-card__row">
					<div class="c-field">
						<label class="c-field__label" for="reg-username">Username</label>
						<input
							class="c-field__input"
							id="reg-username"
							name="username"
							type="text"
							autocomplete="username"
							autocapitalize="off"
							spellcheck="false"
							placeholder="a-z, 0-9, - _"
							required
						/>
					</div>

					<div class="c-field">
						<label class="c-field__label" for="reg-team">Team</label>
						<input
							class="c-field__input"
							id="reg-team"
							name="team"
							type="text"
							autocapitalize="words"
							placeholder="Optional"
						/>
					</div>
				</div>

				<div class="c-field">
					<label class="c-field__label" for="reg-password">Password</label>
					<input
						class="c-field__input"
						id="reg-password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
					/>
					<span class="c-field__hint">At least 6 characters</span>
				</div>

				<button class="c-login-card__submit" type="submit" disabled={loading}>
					{loading ? 'Creating account…' : 'Create account'}
				</button>
			</form>

			<p class="c-login-card__switch">
				Already registered?
				<button type="button" class="c-login-card__switch-link" onclick={() => { tab = 'signin'; }}>
					Sign in
				</button>
			</p>
		{/if}

	</main>
</div>