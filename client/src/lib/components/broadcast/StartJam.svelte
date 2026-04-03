<script lang="ts">
    import { onMount } from 'svelte';
    import JSConfetti from 'js-confetti';

    onMount(() => {
        const confetti = new JSConfetti();
        confetti.addConfetti({
            confettiColors: ['#1ac0d7', '#107c9d', '#ffffff', '#f8f7f5', '#ffdd57', '#ff6b6b'],
            confettiNumber: 300,
        });
    });
</script>

<div class="app-start-jam">
    <img
        class="app-start-jam__gif"
        src="https://media.giphy.com/media/yvF8vn52j9XP6U2vSz/giphy.gif"
        alt=""
        aria-hidden="true"
    />
</div>

<style>
    .app-start-jam {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        background: var(--color-broadcast-bg, #08090b);
        overflow: hidden;
    }

    .app-start-jam__gif {
        width: 50%;
        height: auto;
        object-fit: cover;
    }
</style>