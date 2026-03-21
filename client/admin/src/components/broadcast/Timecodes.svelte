<script lang="ts">
  import { onMount } from 'svelte';
  import { socketState } from '../../lib/socket.svelte.ts';

  let now = $state(Date.now());

  onMount(() => {
    const id = setInterval(() => { now = Date.now(); }, 500);
    return () => clearInterval(id);
  });

  function hms(ms: number): string {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function wallClock(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  function absTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const jam       = $derived(socketState.globalState?.jam ?? null);
  const broadcast = $derived(socketState.globalState?.broadcast ?? null);

  const elapsed   = $derived(jam?.startedAt != null ? now - jam.startedAt : null);
  const remaining = $derived(jam?.endsAt    != null ? jam.endsAt - now    : null);
  const toTrigger = $derived(broadcast?.nextTriggerAt != null ? broadcast.nextTriggerAt - now : null);
</script>

<div class="timecodes">

  <div class="timecodes__item">
    <span class="timecodes__label">clock</span>
    <span class="timecodes__value">{wallClock(now)}</span>
  </div>

  <div class="timecodes__item" class:timecodes__item--inactive={elapsed === null}>
    <span class="timecodes__label">H+</span>
    <span class="timecodes__value">{elapsed !== null ? hms(elapsed) : '--:--:--'}</span>
  </div>

  <div
    class="timecodes__item"
    class:timecodes__item--inactive={remaining === null}
    class:timecodes__item--warn={remaining !== null && remaining < 300_000}
  >
    <span class="timecodes__label">T−</span>
    <span class="timecodes__value">{remaining !== null ? hms(remaining) : '--:--:--'}</span>
  </div>

  <div class="timecodes__item" class:timecodes__item--inactive={!jam?.endsAt}>
    <span class="timecodes__label">end</span>
    <span class="timecodes__value">{jam?.endsAt ? absTime(jam.endsAt) : '--:--'}</span>
  </div>

  <div class="timecodes__item" class:timecodes__item--inactive={toTrigger === null || toTrigger <= 0}>
    <span class="timecodes__label">next</span>
    <span class="timecodes__value">{toTrigger !== null && toTrigger > 0 ? hms(toTrigger) : '--:--:--'}</span>
  </div>

</div>

<style>
  .timecodes {
    display: flex;
    align-items: center;
    height: 28px;
    background: var(--bg-deep);
    border-top: 1px solid var(--border-dim);
    flex-shrink: 0;
  }

  .timecodes__item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 0 16px;
    border-left: 1px solid var(--border-dim);
  }

  .timecodes__item:first-child { border-left: none; }

  .timecodes__label {
    font-size: var(--font-size-xs);
    font-variant: small-caps;
    letter-spacing: 0.08em;
    color: var(--text-muted); /* #888 — 5.6:1 on --bg-deep */
  }

  .timecodes__value {
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text); /* #dcdcdc — 13.8:1 on --bg-deep */
    letter-spacing: 0.03em;
  }

  /* Inactive: intentionally recessive, still legible (~3:1) */
  .timecodes__item--inactive .timecodes__label,
  .timecodes__item--inactive .timecodes__value {
    color: var(--text-dim); /* #555 — 3.0:1 on --bg-deep */
  }

  .timecodes__item--warn .timecodes__value {
    color: var(--warning);
  }
</style>
