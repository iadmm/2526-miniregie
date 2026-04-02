<script lang="ts">
	import { onMount } from 'svelte';

	const BROADCAST_W = 1920;
	const BROADCAST_H = 1080;
	const MAX_ZOOM = 4;

	let wrap: HTMLDivElement;

	let containerW = $state(0);
	let zoom = $state(1); // 1 = fit view
	let panX = $state(0);
	let panY = $state(0);
	let interactMode = $state(true); // passes pointer-events through to iframe

	let isDragging = false;
	let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

	let containerH = $derived(containerW * (BROADCAST_H / BROADCAST_W));
	let fitScale = $derived(containerW > 0 ? containerW / BROADCAST_W : 1);
	let scale = $derived(fitScale * zoom);

	// Translate so the iframe is centered in the container, then offset by pan
	let tx = $derived(containerW / 2 - (BROADCAST_W / 2) * scale + panX);
	let ty = $derived(containerH / 2 - (BROADCAST_H / 2) * scale + panY);

	let iframeTransform = $derived(`translate(${tx}px, ${ty}px) scale(${scale})`);
	let isZoomed = $derived(zoom > 1.01);
	let zoomLabel = $derived(`${zoom.toFixed(1)}×`);

	function clampPan(z: number, px: number, py: number) {
		const scaledW = BROADCAST_W * fitScale * z;
		const scaledH = BROADCAST_H * fitScale * z;
		const maxX = Math.max(0, (scaledW - containerW) / 2);
		const maxY = Math.max(0, (scaledH - containerH) / 2);
		return {
			x: Math.max(-maxX, Math.min(maxX, px)),
			y: Math.max(-maxY, Math.min(maxY, py)),
		};
	}

	function onWheel(e: WheelEvent) {
		if (interactMode) return;
		e.preventDefault();
		const rect = wrap.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;
		const newZoom = Math.max(1, Math.min(MAX_ZOOM, zoom * factor));
		const newScale = fitScale * newZoom;

		// Zoom toward mouse pointer: preserve the content point under the cursor
		const contentX = (mx - tx) / scale;
		const contentY = (my - ty) / scale;
		const newTx = mx - contentX * newScale;
		const newTy = my - contentY * newScale;

		// Convert tx/ty back to panX/panY
		const centerTx = containerW / 2 - (BROADCAST_W / 2) * newScale;
		const centerTy = containerH / 2 - (BROADCAST_H / 2) * newScale;

		zoom = newZoom;
		if (newZoom <= 1) {
			panX = 0;
			panY = 0;
		} else {
			const clamped = clampPan(newZoom, newTx - centerTx, newTy - centerTy);
			panX = clamped.x;
			panY = clamped.y;
		}
	}

	function onMouseDown(e: MouseEvent) {
		if (interactMode || !isZoomed) return;
		isDragging = true;
		dragStart = { x: e.clientX, y: e.clientY, panX, panY };
		e.preventDefault();
	}

	function onMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		const clamped = clampPan(zoom, dragStart.panX + dx, dragStart.panY + dy);
		panX = clamped.x;
		panY = clamped.y;
	}

	function onMouseUp() {
		isDragging = false;
	}

	function resetView() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	onMount(() => {
		const ro = new ResizeObserver((entries) => {
			containerW = entries[0].contentRect.width;
		});
		ro.observe(wrap);
		return () => ro.disconnect();
	});
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<section class="c-broadcast-preview">
	<p class="c-admin__label">Broadcast preview</p>
	<div
		class="c-broadcast-preview__frame-wrap"
		class:is-zoomed={isZoomed && !interactMode}
		class:is-interact={interactMode}
		bind:this={wrap}
		onwheel={onWheel}
		onmousedown={onMouseDown}
		role="region"
		aria-label="Broadcast preview"
	>
		<iframe
			class="c-broadcast-preview__frame"
			class:is-interactive={interactMode}
			src="/broadcast"
			title="Broadcast preview"
			style="transform: {iframeTransform}"
		></iframe>

		<div class="c-broadcast-preview__hud">
			{#if isZoomed}
				<span class="c-broadcast-preview__zoom-label">{zoomLabel}</span>
				<button class="c-broadcast-preview__reset" onclick={resetView}>Fit</button>
			{/if}
			<button
				class="c-broadcast-preview__interact"
				class:is-active={interactMode}
				onclick={() => (interactMode = !interactMode)}
				title={interactMode ? 'Exit interact mode' : 'Interact with broadcast'}
			>
				{interactMode ? 'Lock' : 'Interact'}
			</button>
		</div>
	</div>
</section>