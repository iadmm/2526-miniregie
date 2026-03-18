import { io } from 'socket.io-client';
import type { GlobalState } from '@shared/types';

// ─── Socket connection ────────────────────────────────────────────────────────

export const socket = io({ path: '/socket.io', autoConnect: true });

// ─── Reactive state (Svelte 5 runes) ─────────────────────────────────────────
// Named `socketState` to avoid conflict with Svelte 5 `$state` rune resolution.

export const socketState = $state<{
  globalState: GlobalState | null;
  timeRemaining: number | null;
  connected: boolean;
}>({
  globalState: null,
  timeRemaining: null,
  connected: false,
});

// ─── Socket event handlers ────────────────────────────────────────────────────

socket.on('connect', () => {
  socketState.connected = true;
});

socket.on('disconnect', () => {
  socketState.connected = false;
});

socket.on('state', (s: GlobalState) => {
  socketState.globalState = s;
  // timeRemaining is also embedded in GlobalState
  socketState.timeRemaining = s.jam.timeRemaining;
});

socket.on('tick', (payload: { timeRemaining: number | null }) => {
  socketState.timeRemaining = payload.timeRemaining;
  // Keep globalState.jam in sync
  if (socketState.globalState) {
    socketState.globalState.jam.timeRemaining = payload.timeRemaining;
  }
});