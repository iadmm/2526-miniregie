<script lang="ts">
  import { onMount } from 'svelte';
  import { socketState } from '../../lib/socket.svelte';
  import Timecodes from './Timecodes.svelte';

  const BROADCAST_URL = (import.meta.env.VITE_BROADCAST_URL as string | undefined) ?? '/';

  const activeApp       = $derived(socketState.globalState?.broadcast.activeApp ?? null);
  const isTransitioning = $derived(socketState.globalState?.broadcast.transition === 'in_progress');

  // --- Pan/zoom state ---
  const NATIVE_W = 1920;
  const NATIVE_H = 1080;

  let previewWrap = $state<HTMLDivElement | undefined>(undefined);
  let scale     = $state(1);
  let panX      = $state(0);
  let panY      = $state(0);
  let fitScale  = $state(1);
  let isDragging = $state(false);
  let dragStart  = { x: 0, y: 0, px: 0, py: 0 };

  const zoomPct   = $derived(Math.round((scale / fitScale) * 100));
  const transform = $derived(`translate(${panX}px,${panY}px) scale(${scale})`);

  function center(fs: number, w: number, h: number) {
    panX = (w - NATIVE_W * fs) / 2;
    panY = (h - NATIVE_H * fs) / 2;
  }

  function resetView() {
    if (!previewWrap) return;
    const { width, height } = previewWrap.getBoundingClientRect();
    const fs = Math.min(width / NATIVE_W, height / NATIVE_H);
    fitScale = fs;
    scale = fs;
    center(fs, width, height);
  }

  onMount(() => {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const fs = Math.min(width / NATIVE_W, height / NATIVE_H);
      const wasAtFit = Math.abs(scale - fitScale) < 0.001;
      fitScale = fs;
      if (wasAtFit) {
        scale = fs;
        center(fs, width, height);
      }
    });
    if (previewWrap) ro.observe(previewWrap);
    return () => ro.disconnect();
  });

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor   = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(fitScale * 0.5, Math.min(fitScale * 10, scale * factor));
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    panX = cx - (cx - panX) * (newScale / scale);
    panY = cy - (cy - panY) * (newScale / scale);
    scale = newScale;
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY, px: panX, py: panY };
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    panX = dragStart.px + (e.clientX - dragStart.x);
    panY = dragStart.py + (e.clientY - dragStart.y);
  }

  function onMouseUp() { isDragging = false; }
</script>

<div class="program-monitor">
  <div class="panel-header">
    <span class="panel-label">Program Monitor</span>
    {#if isTransitioning}
      <span class="transitioning">⟳ transition…</span>
    {:else if activeApp}
      <span class="active-label">{activeApp}</span>
    {/if}
  </div>

  <!-- Preview with pan/zoom -->
  <div
    class="preview-wrap"
    bind:this={previewWrap}
    onwheel={onWheel}
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    onmouseup={onMouseUp}
    onmouseleave={onMouseUp}
    ondblclick={resetView}
    style="cursor:{isDragging ? 'grabbing' : 'grab'}"
    role="img"
    aria-label="Broadcast preview"
  >
    <div class="preview-canvas" style="transform:{transform}; transform-origin:top left; position:absolute; top:0; left:0;">
      <iframe
        src={BROADCAST_URL}
        title="Broadcast"
        sandbox="allow-scripts allow-same-origin"
        scrolling="no"
        style="width:{NATIVE_W}px; height:{NATIVE_H}px; border:none; display:block; pointer-events:none;"
      ></iframe>
    </div>

    <div class="zoom-badge">{zoomPct}%</div>
    <button class="zoom-reset" onclick={resetView} title="Reset view (dbl-click)">↺</button>
  </div>
</div>

<style>
  .program-monitor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #111111;
    overflow: hidden;
  }

  .active-label {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--accent);
  }

  .transitioning {
    font-size: var(--font-size-sm);
    color: var(--warning);
    animation: blink 0.6s step-end infinite;
  }

  /* Preview */
  .preview-wrap {
    flex: 1;
    background: #000;
    overflow: hidden;
    position: relative;
    user-select: none;
  }

  /* Zoom overlay controls */
  .zoom-badge {
    position: absolute;
    bottom: 6px;
    left: 8px;
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: rgba(255,255,255,0.5);
    background: rgba(0,0,0,0.5);
    padding: 1px 5px;
    border-radius: 3px;
    pointer-events: none;
    z-index: 10;
  }

  .zoom-reset {
    position: absolute;
    bottom: 4px;
    right: 8px;
    background: rgba(0,0,0,0.55);
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.6);
    font-size: var(--font-size-md);
    line-height: 1;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    padding: 0;
    transition: color 0.1s, background 0.1s;
  }

  .zoom-reset:hover {
    background: rgba(0,0,0,0.8);
    color: #fff;
  }

</style>
