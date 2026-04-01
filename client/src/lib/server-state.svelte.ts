import { io, type Socket } from 'socket.io-client';
import type { GlobalState, LayoutName, MediaItem } from '@shared/types';
import { jamModeState, type JamSlotTimings } from './jam-mode-state.svelte';

export interface LowerThirdState {
	label: string;
	name:  string;
	role:  string;
}

async function syncActiveAppState(): Promise<void> {
	const res = await fetch('/api/active-app/state');
	if (res.status === 204) return;
	const data = await res.json() as { layout?: LayoutName; slots?: JamSlots; timing?: JamSlotTimings; lowerThird?: LowerThirdState | null };
	if (data.layout     !== undefined) serverState.jamLayout   = data.layout;
	if (data.slots      !== undefined) serverState.jamSlots    = data.slots;
	if (data.timing     !== undefined) jamModeState.slotTimings = data.timing;
	if (data.lowerThird !== undefined) serverState.lowerThird  = data.lowerThird ?? null;
}

export interface JamSlots {
	loud?:    MediaItem;
	visual?:  MediaItem;
	visual2?: MediaItem;
	note?:    MediaItem;
}

interface ServerState {
	connected:  boolean;
	state:      GlobalState | null;
	jamLayout:  LayoutName | null;
	jamSlots:   JamSlots;
	lowerThird: LowerThirdState | null;
}

export const serverState = $state<ServerState>({
	connected:  false,
	state:      null,
	jamLayout:  null,
	jamSlots:   {},
	lowerThird: null,
});

let socket: Socket | null = null;

export function connectSocket(): void {
	if (socket) return;

	socket = io({ path: '/socket.io' });

	socket.on('connect', () => {
		serverState.connected = true;
		void syncActiveAppState();
	});

	socket.on('disconnect', () => {
		serverState.connected = false;
	});

	socket.on('state', (data: GlobalState) => {
		serverState.state = data;
	});

	socket.on('jam-mode:layout', (data: { layout: LayoutName; slots: JamSlots; timing?: JamSlotTimings }) => {
		serverState.jamLayout      = data.layout;
		serverState.jamSlots       = data.slots;
		jamModeState.slotTimings   = data.timing ?? {};
	});

	socket.on('jam-mode:lower-third:show', (data: LowerThirdState) => {
		serverState.lowerThird = data;
	});

	socket.on('jam-mode:lower-third:hide', () => {
		serverState.lowerThird = null;
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