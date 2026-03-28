import { io, type Socket } from 'socket.io-client';
import type { GlobalState, ActiveScene } from '@shared/types';

interface ServerState {
	connected: boolean;
	state: GlobalState | null;
	scene: ActiveScene | null;
}

export const serverState = $state<ServerState>({
	connected: false,
	state: null,
	scene: null,
});

let socket: Socket | null = null;

export function connectSocket(): void {
	if (socket) return;

	socket = io({ path: '/socket.io' });

	socket.on('connect', () => {
		serverState.connected = true;
	});

	socket.on('disconnect', () => {
		serverState.connected = false;
	});

	socket.on('state', (data: GlobalState) => {
		serverState.state = data;
	});

	socket.on('scene:update', (data: ActiveScene) => {
		serverState.scene = data;
	});
}

export function disconnectSocket(): void {
	socket?.disconnect();
	socket = null;
	serverState.connected = false;
}

export function getSocket(): Socket | null {
	return socket;
}