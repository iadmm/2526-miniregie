<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { serverState } from '$lib/server-state.svelte.js';

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
    <div class="c-branding__flag c-branding-flag" aria-hidden="true">
        <span class="c-branding-flag__dot"></span>
        M4TV
    </div>

    <!-- Oscillating clock: real time ↔ countdown -->
    <div class="c-branding__clock c-branding-clock">
            <span class="c-branding-clock__val" class:active={activeShowCountdown}>{clockTime}</span>
        {#if countdownTime !== null}
            <span class="c-branding-clock__val c-branding-clock__countdown" class:active={!activeShowCountdown}>
                <span class="c-branding-clock__icon" aria-hidden="true">▼</span>
                {countdownTime}
            </span>
        {/if}
    </div>
</div>

<style>
    .c-branding{
        position: absolute;
        bottom: calc(2* var(--grid-unit));
        left: calc(2* var(--grid-unit));
        display: flex;
        height: calc(3*var(--grid-unit));
    }
    .c-branding-flag {
        box-sizing: border-box;
        padding: calc(1*var(--grid-unit));
        background: var(--color-brand);
    }
    /* ── Clock oscillation container ──────────────────────────────────────── */

    .c-branding-clock {
        padding: calc(1 * var(--grid-unit));
        background: var(--color-brand-dark);
        width: 200px;
        position: relative;
        overflow: hidden;
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
    }

    /* Countdown rests below the visible strip until animated in */
    .c-branding-clock__countdown {
        transform: translateY(100%);
    }

    /* ── Oscillation — only when a countdown span is in the DOM ───────────── */

    .c-branding-clock:has(.c-branding-clock__countdown) .c-branding-clock__val:first-child {
        animation: bcast-clock-primary 10s linear infinite;
    }

    .c-branding-clock:has(.c-branding-clock__countdown) .c-branding-clock__countdown {
        animation: bcast-clock-secondary 10s linear infinite;
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