// jam-mode entry point.
// Creates its own DOM layer structure inside the mount container and delegates
// all orchestration to SceneCompositor.
//
// Internal DOM (z-index low → high):
//   .scene-layer        — SceneEngine (media items + layouts)
//   .lower-third-layer  — LowerThirdEngine (attribution band + ticker)
//   .clock-layer        — ClockEngine (countdown display)

import type { BroadcastApp } from '../types.js';
import type { GlobalState } from '@shared/types';
import type { Socket } from 'socket.io-client';

import { ClockEngine }      from './jam-mode/clock-engine.js';
import { SceneEngine }      from './jam-mode/scene-engine.js';
import { LowerThirdEngine } from './jam-mode/lower-third-engine.js';
import { SceneCompositor }  from './jam-mode/scene-compositor.js';

export function createJamMode(): BroadcastApp {
  let mounted = false;

  let clockEngine: ClockEngine | null       = null;
  let compositor: SceneCompositor | null    = null;
  let stateHandler: ((s: GlobalState) => void) | null = null;
  let boundSocket: Socket | null = null;

  return {
    mount(container: HTMLElement, state: GlobalState, socket: Socket): void {
      mounted      = true;
      boundSocket  = socket;

      // ── DOM layers ──────────────────────────────────────────────────────
      container.className = 'app app--jam-mode';
      container.innerHTML = '';

      const sceneLayerEl      = document.createElement('div');
      const lowerThirdLayerEl = document.createElement('div');
      const clockLayerEl      = document.createElement('div');

      sceneLayerEl.className      = 'scene-layer';
      lowerThirdLayerEl.className = 'lower-third-layer';
      clockLayerEl.className      = 'clock-layer';

      container.appendChild(sceneLayerEl);
      container.appendChild(lowerThirdLayerEl);
      container.appendChild(clockLayerEl);

      // ── Engines ─────────────────────────────────────────────────────────
      clockEngine = new ClockEngine(clockLayerEl);
      clockEngine.mount(socket, state.jam.timeRemaining);

      const lowerThirdEngine = new LowerThirdEngine(lowerThirdLayerEl);
      const sceneEngine      = new SceneEngine();
      sceneEngine.mount(sceneLayerEl);

      // ── Compositor ──────────────────────────────────────────────────────
      compositor = new SceneCompositor(sceneEngine, lowerThirdEngine, socket);
      compositor.mount(state);

      // ── Snapshot sync ────────────────────────────────────────────────────
      stateHandler = (s: GlobalState) => {
        if (!mounted) return;
        compositor?.updateSnapshot(s.pool.queueSnapshot);
      };
      socket.on('state', stateHandler);
    },

    unmount(): void {
      mounted = false;

      if (boundSocket !== null && stateHandler !== null) {
        boundSocket.off('state', stateHandler);
      }

      clockEngine?.destroy(boundSocket!);
      compositor?.destroy();

      clockEngine  = null;
      compositor   = null;
      stateHandler = null;
      boundSocket  = null;
    },
  };
}
