<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { serverState } from '$lib/server-state.svelte';

    // ── Clock ─────────────────────────────────────────────────────

    let now = $state(new Date());
    let showCountdown = $state(false);
    let clockInterval: ReturnType<typeof setInterval> | undefined;
    let oscillInterval: ReturnType<typeof setInterval> | undefined;

    const clockTime = $derived(
        now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', hour12: false })
    );

    const countdownTime = $derived.by(() => {
        const endsAt = serverState.state?.jam.endsAt;
        if (!endsAt) return null;
        const remaining = Math.max(0, endsAt - now.getTime());
        const totalSecs = Math.floor(remaining / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    });

    // Only oscillate when a countdown is available
    const activeShowCountdown = $derived(showCountdown && countdownTime !== null);

    // ── Lifecycle ─────────────────────────────────────────────────

    onMount(() => {
        clockInterval  = setInterval(() => { now = new Date(); }, 1000);
        oscillInterval = setInterval(() => { showCountdown = !showCountdown; }, 5000);
    });

    onDestroy(() => {
        clearInterval(clockInterval);
        clearInterval(oscillInterval);
    });
</script>

<div class="c-branding">
<!-- Flag — UNIQUE colored surface -->
<div class="c-branding-flag" aria-hidden="true">
    <span class="c-branding-flag__dot"></span>
    M4TV
</div>

<!-- Oscillating clock: real time ↔ countdown -->
<div class="c-branding-clock">
		<span
                class="c-branding-clock__val"
                class:active={activeShowCountdown}
        >{clockTime}</span>
    {#if countdownTime !== null}
			<span
                    class="c-branding-clock__val c-branding-clock__countdown"
                    class:active={!activeShowCountdown}
            ><span class="c-branding-clock__icon" aria-hidden="true">▼</span>{countdownTime}</span>
    {/if}
</div>
</div>