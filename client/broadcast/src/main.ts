import { io } from 'socket.io-client';
import type { GlobalState, AppId } from '@shared/types';
import type { BroadcastApp } from './types.js';
import { initPersistentLayer } from './persistent-layer.js';
import { createPreJamIdle } from './apps/pre-jam-idle.js';
import { createCountdownToJam } from './apps/countdown-to-jam.js';
import { createJamMode } from './apps/jam-mode.js';
import { createEndOfCountdown } from './apps/end-of-countdown.js';
import { createPostJamIdle } from './apps/post-jam-idle.js';
import { createMicroTrottoir } from './apps/micro-trottoir.js';

// ─── DOM — three root layers, never modified after DOMContentLoaded ───────────

const appLayer        = document.getElementById('app-layer')!;
const persistentLayer = document.getElementById('persistent-layer')!;
const panicLayer      = document.getElementById('panic-layer')!;

const slotFg = appLayer.querySelector<HTMLDivElement>('#slot-fg')!;
const slotBg = appLayer.querySelector<HTMLDivElement>('#slot-bg')!;

// ─── State ────────────────────────────────────────────────────────────────────

let currentApp: BroadcastApp | null = null;
let currentAppId: AppId | null = null;
let lastState: GlobalState | null = null;

// ─── Watchdog heartbeat ───────────────────────────────────────────────────────

let lastPing = Date.now();
setInterval(() => {
  if (Date.now() - lastPing > 30_000) {
    console.warn('[watchdog] no ping for 30s — reloading');
    window.location.reload();
  }
}, 5_000);

// ─── Socket.io ────────────────────────────────────────────────────────────────

const socket = io({ reconnectionDelayMax: 10_000 });

socket.on('ping', () => {
  lastPing = Date.now();
});

socket.on('connect', () => {
  console.log('[broadcast] connected');
  lastPing = Date.now(); // treat connect as proof of life
});

socket.on('disconnect', () => {
  console.warn('[broadcast] disconnected — displaying last known state');
});

// ─── Panic layer ──────────────────────────────────────────────────────────────

socket.on('broadcast:panic', () => {
  // Synchronous, no animation
  panicLayer.style.display = 'block';
});

// ─── App registry ─────────────────────────────────────────────────────────────

function mountApp(appId: AppId, state: GlobalState): BroadcastApp | null {
  let app: BroadcastApp;

  switch (appId) {
    case 'pre-jam-idle':
      app = createPreJamIdle();
      break;
    case 'countdown-to-jam':
      app = createCountdownToJam();
      break;
    case 'jam-mode':
      app = createJamMode();
      break;
    case 'end-of-countdown':
      app = createEndOfCountdown();
      break;
    case 'post-jam-idle':
      app = createPostJamIdle();
      break;
    case 'micro-trottoir':
      app = createMicroTrottoir();
      break;
    default:
      console.warn(`[broadcast] unknown appId: ${appId}`);
      return null;
  }

  // Use slotFg as the mount target (BroadcastManager slot model simplified for client)
  app.mount(slotFg, state, socket);
  return app;
}

function unmountCurrent(): void {
  if (currentApp !== null) {
    try {
      currentApp.unmount();
    } catch (err) {
      console.error('[broadcast] unmount error:', err);
    }
    currentApp = null;
  }

  // Clean slot DOM — synchronous, double safety
  slotFg.innerHTML = '';
  slotFg.removeAttribute('style');
  slotFg.className = '';

  slotBg.innerHTML = '';
  slotBg.removeAttribute('style');
  slotBg.className = '';
}

// ─── State handler ────────────────────────────────────────────────────────────

function handleState(state: GlobalState): void {
  lastState = state;

  // Panic check first
  if (state.broadcast.panicState) {
    panicLayer.style.display = 'block';
    return;
  }

  // Clear panic layer if previously shown
  panicLayer.style.display = 'none';

  // App transition
  if (state.broadcast.activeApp !== currentAppId) {
    unmountCurrent();
    currentAppId = state.broadcast.activeApp;
    currentApp = mountApp(state.broadcast.activeApp, state);
  }

  // Acknowledge in-progress transitions
  if (state.broadcast.transition === 'in_progress') {
    socket.emit('broadcast:transition:complete');
  }
}

socket.on('state', (state: GlobalState) => {
  handleState(state);
});

// ─── Persistent layer ─────────────────────────────────────────────────────────

// Wait for first state before initialising persistent layer so we have goUrl context.
// Fallback: initialise immediately with a sensible default.
const GO_URL = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/go`;

// Defer until DOM is fully ready (script is module so already deferred)
let persistentLayerReady = false;

socket.on('state', (state: GlobalState) => {
  if (!persistentLayerReady) {
    persistentLayerReady = true;
    initPersistentLayer(persistentLayer, socket, state, GO_URL);
  }
});

// Fallback: if no state event arrives within 3s, init with null state
setTimeout(() => {
  if (!persistentLayerReady) {
    persistentLayerReady = true;
    const emptyState: GlobalState = {
      jam: { status: 'idle', startedAt: null, endsAt: null, timeRemaining: null },
      broadcast: { activeApp: 'pre-jam-idle', transition: 'idle', panicState: false, nextTriggerAt: null },
      pool: { total: 0, fresh: 0, queueSnapshot: [] },
    };
    initPersistentLayer(persistentLayer, socket, emptyState, GO_URL);
  }
}, 3_000);