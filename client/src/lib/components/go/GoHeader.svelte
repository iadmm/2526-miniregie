<script lang="ts">
    import { page } from '$app/state';
    import { submissions } from '$lib/my-submissions.svelte';

    const STATUS_LABEL: Record<string, string> = {
        running: 'JAM en cours',
        ended:   'JAM terminé',
        idle:    'En attente',
    };

    const participant = $derived(page.data.participant);
</script>

<header class="go-header">
    <span class="go-header__brand">MiniRégie</span>

    <span class="go-header__status go-header__status--{submissions.jamStatus}">
        {STATUS_LABEL[submissions.jamStatus] ?? submissions.jamStatus}
    </span>

    <div class="go-header__user">
        {#if participant?.avatarUrl}
            <img class="go-header__avatar" src={participant.avatarUrl} alt="" />
        {/if}
        <span class="go-header__name">{participant?.displayName}</span>
        <form method="POST" action="/?/logout">
            <button class="go-header__signout" type="submit">Sign out</button>
        </form>
    </div>
</header>

<style>
    .go-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        height: 38px;
        padding-inline: 12px;
        background: #25292f;
        color: #c8ccd2;
        font-size: 0.8125rem; /* 13px */
    }

    .go-header__brand {
        font-weight: 600;
        color: #e8eaed;
        letter-spacing: 0.01em;
        margin-inline-end: auto;
    }

    .go-header__status {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 2px 7px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }

    .go-header__status--running { background: #1a3a23; color: #6fcf8a; }
    .go-header__status--idle    { background: #2a2d32; color: #8a8f97; }
    .go-header__status--ended   { background: #3a1f1f; color: #e07575; }

    .go-header__user {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #8a8f97;
    }

    .go-header__avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        object-fit: cover;
        opacity: 0.85;
    }

    .go-header__name {
        color: #b0b5be;
    }

    .go-header__signout {
        background: none;
        border: none;
        color: #555b65;
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0;
        text-decoration: none;
        border-left: 1px solid #3a3f47;
        padding-inline-start: 8px;
        margin-inline-start: 2px;
    }

    .go-header__signout:hover {
        color: #8a8f97;
    }
</style>
