import { io } from 'socket.io-client';
import type { GlobalState } from '@shared/types';

// ─── DOM — trois couches racines, jamais modifiées ────────────────────────────
const appLayer        = document.getElementById('app-layer')!;
const persistentLayer = document.getElementById('persistent-layer')!;
const panicLayer      = document.getElementById('panic-layer')!;

const slotFg = appLayer.querySelector<HTMLDivElement>('#slot-fg')!;
const slotBg = appLayer.querySelector<HTMLDivElement>('#slot-bg')!;

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

socket.on('state', (state: GlobalState) => {
  renderState(state);
});

socket.on('connect', () => {
  console.log('[broadcast] connected');
});

socket.on('disconnect', () => {
  console.warn('[broadcast] disconnected — displaying last known state');
});

// ─── Render ───────────────────────────────────────────────────────────────────
function renderState(state: GlobalState): void {
  // Phase 1 — placeholder
  slotFg.textContent = `app: ${state.broadcast.activeApp} | jam: ${state.jam.status} | pool: ${state.pool.total}`;
}
