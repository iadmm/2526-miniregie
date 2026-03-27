import { io, type Socket } from 'socket.io-client';
import type { GlobalState } from '@shared/types';

interface ServerState {
	connected: boolean;
	state: GlobalState | null;
}

export const serverState = $state<ServerState>({
	connected: false,
	state: null,
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
}

export function disconnectSocket(): void {
	socket?.disconnect();
	socket = null;
	serverState.connected = false;
}

export function getSocket(): Socket | null {
	return socket;
}