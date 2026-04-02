<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { serverState } from '$lib/server-state.svelte.js';

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

    const activeShowCountdown = $derived(showCountdown && countdownTime !== null);

    onMount(() => {
        clockInterval  = setInterval(() => { now = new Date(); }, 1000);
        oscillInterval = setInterval(() => { showCountdown = !showCountdown; }, 5000);
    });

    onDestroy(() => {
        clearInterval(clockInterval);
        clearInterval(oscillInterval);
    });
</script>

<div class="c-branding-clock">
    <span class="c-branding-clock__val" class:active={activeShowCountdown}>{clockTime}</span>
    {#if countdownTime !== null}
        <span class="c-branding-clock__val c-branding-clock__countdown" class:active={!activeShowCountdown}>
            <span class="c-branding-clock__icon" aria-hidden="true">▼</span>
            {countdownTime}
        </span>
    {/if}
</div>

<style>
    .c-branding-clock {
        padding: calc(1 * var(--grid-unit));
        background: var(--color-brand-dark);
        width: calc(8 * var(--grid-unit));
        position: relative;
        overflow: hidden;
        font-weight: var(--font-weight-bold);
        font-family: var(--font-editorial);
        color: var(--color-surface);
        font-size: var(--font-size-large);
    }

    .c-branding-clock__val {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        bottom: 0;
        white-space: nowrap;
        line-height: 1;
        box-sizing: border-box;
        padding: 0 calc(1 * var(--grid-unit));
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .c-branding-clock__countdown {
        transform: translateY(100%);
        color: var(--color-danger-washed);
    }

    .c-branding-clock__icon{
        color: var(--color-danger);
    }

    .c-branding-clock:has(.c-branding-clock__countdown) .c-branding-clock__val:first-child {
        animation: bcast-clock-primary 10s ease-in-out infinite;
    }

    .c-branding-clock:has(.c-branding-clock__countdown) .c-branding-clock__countdown {
        animation: bcast-clock-secondary 10s ease-in-out infinite;
    }

    /*
     * Cycle (10 s):
     *   0 → 4 s   clock time visible, countdown below
     *   4 → 5 s   clock slides up, countdown slides in
     *   5 → 9 s   countdown visible, clock above
     *   9 → 10 s  clock slides back, countdown exits
     */

    @keyframes bcast-clock-primary {
        0%   { transform: translateY(0);     animation-timing-function: linear; }
        40%  { transform: translateY(0);     animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        50%  { transform: translateY(-100%); animation-timing-function: linear; }
        90%  { transform: translateY(-100%); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        100% { transform: translateY(0);     }
    }

    @keyframes bcast-clock-secondary {
        0%   { transform: translateY(100%);  animation-timing-function: linear; }
        40%  { transform: translateY(100%);  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        50%  { transform: translateY(0);     animation-timing-function: linear; }
        90%  { transform: translateY(0);     animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        100% { transform: translateY(100%);  }
    }
</style>