<script lang="ts">
	import { auth, logout } from '$lib/auth.svelte';
	import { goto } from '$app/navigation';

	async function handleLogout() {
		await logout();
		goto('/login');
	}
</script>

<div>
	Coucou

	{#if !auth.loading && auth.participant}
		{#if auth.participant.role === 'admin'}
			<a href="/admin">Admin</a>
			<a href="/broadcast">Broadcast</a>
		{/if}
		<button class="c-btn" type="button" onclick={handleLogout}>Sign out</button>
	{/if}
</div>