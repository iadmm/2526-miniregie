<script lang="ts">
	import { onMount } from 'svelte';
	import { auth, login, logout } from '$lib/auth.svelte';
	import { goto } from '$app/navigation';
	import type { MediaItem, Participant } from '@shared/types';

	// ── Auth / onboarding state ───────────────────────────────────────────────

	type View = 'loading' | 'register' | 'login' | 'onboarding' | 'submit';

	let view = $state<View>('loading');

	$effect(() => {
		if (auth.loading) { view = 'loading'; return; }
		if (!auth.participant) { view = 'register'; return; }
		if (!auth.participant.avatarUrl) { view = 'onboarding'; return; }
		view = 'submit';
	});

	// ── Registration ──────────────────────────────────────────────────────────

	let regUsername    = $state('');
	let regDisplayName = $state('');
	let regTeam        = $state('');
	let regPassword    = $state('');
	let regError       = $state('');
	let regBusy        = $state(false);
	let teams          = $state<string[]>([]);
	let showLogin      = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/go/api/teams');
			if (res.ok) teams = (await res.json()) as string[];
		} catch { /* ignore */ }
	});

	async function handleRegister(e: SubmitEvent) {
		e.preventDefault();
		regError = '';
		regBusy = true;
		try {
			const res = await fetch('/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username:    regUsername.trim(),
					displayName: regDisplayName.trim(),
					team:        regTeam.trim(),
					password:    regPassword,
				}),
			});
			const data = (await res.json()) as { participant?: Participant; error?: string };
			if (!res.ok) { regError = data.error ?? 'Registration failed'; return; }
			auth.participant = data.participant ?? null;
		} catch {
			regError = 'Network error';
		} finally {
			regBusy = false;
		}
	}

	// ── Login ─────────────────────────────────────────────────────────────────

	let loginUsername = $state('');
	let loginPassword = $state('');
	let loginError    = $state('');
	let loginBusy     = $state(false);

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		loginError = '';
		loginBusy = true;
		const result = await login(loginUsername, loginPassword);
		loginBusy = false;
		if (result.error) loginError = result.error;
	}

	async function handleLogout() {
		await logout();
	}

	// ── Onboarding (avatar) ───────────────────────────────────────────────────

	let avatarFile    = $state<File | null>(null);
	let avatarPreview = $state('');
	let avatarError   = $state('');
	let avatarBusy    = $state(false);

	function handleAvatarPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file  = input.files?.[0] ?? null;
		avatarFile    = file;
		avatarPreview = file ? URL.createObjectURL(file) : '';
	}

	async function handleAvatarSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!avatarFile) return;
		avatarError = '';
		avatarBusy  = true;
		try {
			const fd = new FormData();
			fd.append('avatar', avatarFile);
			const res  = await fetch('/go/api/onboarding/avatar', { method: 'POST', body: fd });
			const data = (await res.json()) as { participant?: Participant; error?: string };
			if (!res.ok) { avatarError = data.error ?? 'Upload failed'; return; }
			auth.participant = data.participant ?? null;
		} catch {
			avatarError = 'Network error';
		} finally {
			avatarBusy = false;
		}
	}

	// ── Submission ────────────────────────────────────────────────────────────

	type SubmitType = 'note' | 'photo' | 'gif' | 'clip' | 'link' | 'ticker';

	let submitType   = $state<SubmitType>('note');
	let noteText     = $state('');
	let tickerText   = $state('');
	let linkUrl      = $state('');
	let mediaFile    = $state<File | null>(null);
	let submitError  = $state('');
	let submitOk     = $state('');
	let submitBusy   = $state(false);

	function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		mediaFile = input.files?.[0] ?? null;
	}

	function resetForm() {
		noteText    = '';
		tickerText  = '';
		linkUrl     = '';
		mediaFile   = null;
		submitError = '';
		submitOk    = '';
	}

	$effect(() => {
		// Reset fields when type changes
		submitType;
		resetForm();
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		submitError = '';
		submitOk    = '';
		submitBusy  = true;

		try {
			const fd = new FormData();
			fd.append('type', submitType);

			if (submitType === 'note') {
				if (!noteText.trim()) { submitError = 'Write something first'; submitBusy = false; return; }
				fd.append('text', noteText.trim());
			} else if (submitType === 'ticker') {
				if (!tickerText.trim()) { submitError = 'Write a ticker message'; submitBusy = false; return; }
				fd.append('text', tickerText.trim());
			} else if (submitType === 'link') {
				if (!linkUrl.trim()) { submitError = 'Enter a URL'; submitBusy = false; return; }
				fd.append('url', linkUrl.trim());
			} else {
				if (!mediaFile) { submitError = 'Choose a file'; submitBusy = false; return; }
				fd.append('file', mediaFile);
			}

			const res  = await fetch('/go/api/submit', { method: 'POST', body: fd });
			const data = (await res.json()) as { item?: MediaItem; error?: string };

			if (!res.ok) {
				submitError = data.error ?? 'Submission failed';
				return;
			}

			submitOk    = 'Submitted!';
			noteText    = '';
			tickerText  = '';
			linkUrl     = '';
			mediaFile   = null;

			// Refresh list
			await loadMyItems();
		} catch {
			submitError = 'Network error';
		} finally {
			submitBusy = false;
		}
	}

	// ── My items ──────────────────────────────────────────────────────────────

	let myItems      = $state<MediaItem[]>([]);
	let jamStatus    = $state<'idle' | 'running' | 'ended'>('idle');
	let itemsLoading = $state(false);

	async function loadMyItems() {
		if (!auth.participant) return;
		itemsLoading = true;
		try {
			const res  = await fetch('/go/api/status');
			if (!res.ok) return;
			const data = (await res.json()) as { jamStatus: 'idle' | 'running' | 'ended'; myItems: MediaItem[] };
			jamStatus = data.jamStatus;
			myItems   = data.myItems;
		} finally {
			itemsLoading = false;
		}
	}

	$effect(() => {
		if (view === 'submit') void loadMyItems();
	});

	function contentPreview(item: MediaItem): string {
		const c = item.content as unknown as Record<string, unknown>;
		if ('text'  in c && typeof c['text']  === 'string') return c['text'].slice(0, 80);
		if ('title' in c && typeof c['title'] === 'string') return c['title'].slice(0, 80);
		if ('url'   in c && typeof c['url']   === 'string') return (c['url'] as string).slice(0, 80);
		return '—';
	}

	const STATUS_LABEL: Record<MediaItem['status'], string> = {
		pending: 'Pending',
		ready:   'In queue',
		played:  'Played',
		evicted: 'Dropped',
	};

	const TYPE_LABEL: Record<string, string> = {
		note: 'Note', photo: 'Photo', gif: 'GIF', clip: 'Video', link: 'Link',
		youtube: 'YouTube', giphy: 'Giphy', ticker: 'Ticker', interview: 'Interview',
	};
</script>

<div class="c-go">

	<!-- ── Loading ───────────────────────────────────────────────────────────── -->
	{#if view === 'loading'}
		<p class="c-go__loading">Loading…</p>

	<!-- ── Register / Login ──────────────────────────────────────────────────── -->
	{:else if view === 'register' || view === 'login'}
		<main class="c-go__auth">
			<h1 class="c-go__site-title">MiniRégie</h1>

			<nav class="c-go__auth-tabs">
				<button
					class="c-go__auth-tab"
					class:c-go__auth-tab--active={!showLogin}
					type="button"
					onclick={() => { showLogin = false; }}
				>New account</button>
				<button
					class="c-go__auth-tab"
					class:c-go__auth-tab--active={showLogin}
					type="button"
					onclick={() => { showLogin = true; }}
				>Sign in</button>
			</nav>

			{#if !showLogin}
				<form class="c-go__form" onsubmit={handleRegister}>
					{#if regError}<p class="c-go__error" role="alert">{regError}</p>{/if}

					<div class="c-field">
						<label class="c-field__label" for="reg-display">Your name</label>
						<input class="c-field__input" id="reg-display" type="text" bind:value={regDisplayName} required autocomplete="name" />
					</div>

					<div class="c-field">
						<label class="c-field__label" for="reg-team">Team / project</label>
						<input
							class="c-field__input"
							id="reg-team"
							type="text"
							bind:value={regTeam}
							list="team-suggestions"
							autocomplete="off"
						/>
						{#if teams.length > 0}
							<datalist id="team-suggestions">
								{#each teams as t}<option value={t}></option>{/each}
							</datalist>
						{/if}
					</div>

					<div class="c-field">
						<label class="c-field__label" for="reg-username">Username</label>
						<input class="c-field__input" id="reg-username" type="text" bind:value={regUsername} required autocomplete="username" />
					</div>

					<div class="c-field">
						<label class="c-field__label" for="reg-password">Password</label>
						<input class="c-field__input" id="reg-password" type="password" bind:value={regPassword} required minlength="6" autocomplete="new-password" />
					</div>

					<button class="c-btn c-btn--primary" type="submit" disabled={regBusy}>
						{regBusy ? 'Creating…' : 'Create account'}
					</button>
				</form>

			{:else}
				<form class="c-go__form" onsubmit={handleLogin}>
					{#if loginError}<p class="c-go__error" role="alert">{loginError}</p>{/if}

					<div class="c-field">
						<label class="c-field__label" for="login-username">Username</label>
						<input class="c-field__input" id="login-username" type="text" bind:value={loginUsername} required autocomplete="username" />
					</div>

					<div class="c-field">
						<label class="c-field__label" for="login-password">Password</label>
						<input class="c-field__input" id="login-password" type="password" bind:value={loginPassword} required autocomplete="current-password" />
					</div>

					<button class="c-btn c-btn--primary" type="submit" disabled={loginBusy}>
						{loginBusy ? 'Signing in…' : 'Sign in'}
					</button>
				</form>
			{/if}
		</main>

	<!-- ── Onboarding ─────────────────────────────────────────────────────────── -->
	{:else if view === 'onboarding'}
		<main class="c-go__auth">
			<h1 class="c-go__site-title">One more step</h1>
			<p class="c-go__onboarding-hint">Upload a profile photo to complete your account.</p>

			<form class="c-go__form" onsubmit={handleAvatarSubmit}>
				{#if avatarError}<p class="c-go__error" role="alert">{avatarError}</p>{/if}

				{#if avatarPreview}
					<img class="c-go__avatar-preview" src={avatarPreview} alt="Avatar preview" />
				{/if}

				<div class="c-field">
					<label class="c-field__label" for="avatar-file">Profile photo</label>
					<input
						class="c-field__input"
						id="avatar-file"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onchange={handleAvatarPick}
						required
					/>
				</div>

				<button class="c-btn c-btn--primary" type="submit" disabled={avatarBusy || !avatarFile}>
					{avatarBusy ? 'Uploading…' : 'Save photo'}
				</button>
			</form>
		</main>

	<!-- ── Main submission interface ─────────────────────────────────────────── -->
	{:else if view === 'submit'}
		<header class="c-go__header">
			<span class="c-go__site-name">MiniRégie</span>

			<span class="c-go__jam-status c-go__jam-status--{jamStatus}">
				{#if jamStatus === 'running'}JAM en cours
				{:else if jamStatus === 'ended'}JAM terminé
				{:else}En attente{/if}
			</span>

			<span class="c-go__user">
				{#if auth.participant?.avatarUrl}
					<img class="c-go__user-avatar" src={auth.participant.avatarUrl} alt="" />
				{/if}
				{auth.participant?.displayName}
				<button class="c-go__signout" type="button" onclick={handleLogout}>Sign out</button>
			</span>
		</header>

		<div class="c-go__body">

			<!-- Submit form -->
			<section class="c-go__section">
				<h2 class="c-go__section-title">Submit</h2>

				<div class="c-go__type-selector" role="group" aria-label="Content type">
					{#each (['note', 'photo', 'gif', 'clip', 'link', 'ticker'] as SubmitType[]) as t}
						<button
							class="c-go__type-btn"
							class:c-go__type-btn--active={submitType === t}
							type="button"
							onclick={() => { submitType = t; }}
						>{TYPE_LABEL[t]}</button>
					{/each}
				</div>

				<form class="c-go__submit-form" onsubmit={handleSubmit}>
					{#if submitError}<p class="c-go__error" role="alert">{submitError}</p>{/if}
					{#if submitOk}<p class="c-go__ok" role="status">{submitOk}</p>{/if}

					{#if submitType === 'note'}
						<div class="c-field">
							<label class="c-field__label" for="note-text">Message</label>
							<textarea
								class="c-field__input c-go__textarea"
								id="note-text"
								bind:value={noteText}
								placeholder="Write your message…"
								maxlength="500"
								required
							></textarea>
							<span class="c-go__char-count">{noteText.length}/500</span>
						</div>

					{:else if submitType === 'ticker'}
						<div class="c-field">
							<label class="c-field__label" for="ticker-text">Ticker message</label>
							<input
								class="c-field__input"
								id="ticker-text"
								type="text"
								bind:value={tickerText}
								placeholder="Short scrolling message…"
								maxlength="120"
								required
							/>
							<span class="c-go__char-count">{tickerText.length}/120</span>
						</div>

					{:else if submitType === 'link'}
						<div class="c-field">
							<label class="c-field__label" for="link-url">URL</label>
							<input
								class="c-field__input"
								id="link-url"
								type="url"
								bind:value={linkUrl}
								placeholder="https://…"
								required
							/>
						</div>

					{:else if submitType === 'photo' || submitType === 'gif'}
						<div class="c-field">
							<label class="c-field__label" for="media-file">
								{submitType === 'gif' ? 'GIF file' : 'Image file'}
							</label>
							<input
								class="c-field__input"
								id="media-file"
								type="file"
								accept={submitType === 'gif' ? 'image/gif' : 'image/jpeg,image/png,image/webp'}
								onchange={handleFileChange}
								required
							/>
						</div>

					{:else if submitType === 'clip'}
						<div class="c-field">
							<label class="c-field__label" for="clip-file">Video file</label>
							<input
								class="c-field__input"
								id="clip-file"
								type="file"
								accept="video/*"
								onchange={handleFileChange}
								required
							/>
						</div>
					{/if}

					<button class="c-btn c-btn--primary" type="submit" disabled={submitBusy || jamStatus !== 'running'}>
						{#if submitBusy}Sending…
						{:else if jamStatus !== 'running'}JAM not active
						{:else}Send
						{/if}
					</button>
				</form>
			</section>

			<!-- My submissions -->
			<section class="c-go__section">
				<h2 class="c-go__section-title">
					My submissions
					<button class="c-go__refresh" type="button" onclick={loadMyItems} aria-label="Refresh">↺</button>
				</h2>

				{#if itemsLoading}
					<p class="c-go__empty">Loading…</p>
				{:else if myItems.length === 0}
					<p class="c-go__empty">Nothing submitted yet.</p>
				{:else}
					<ul class="c-go__items">
						{#each myItems as item (item.id)}
							<li class="c-go__item">
								<span class="c-go__item-type">{TYPE_LABEL[item.type] ?? item.type}</span>
								<span class="c-go__item-preview">{contentPreview(item)}</span>
								<span class="c-go__item-status c-go__item-status--{item.status}">
									{STATUS_LABEL[item.status]}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

		</div>
	{/if}

</div>
