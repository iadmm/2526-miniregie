import { io, type Socket } from 'socket.io-client';
import type { GlobalState, LayoutName, MediaItem, TickerContent } from '@shared/types';
import { jamModeState, type JamSlotTimings, type EnrichState } from './jam-mode-state.svelte';
import { logEvent } from './broadcast-log.svelte';
import { fetchPoolItems } from './pool-items.svelte';
import {
  startCompanionIntro,
  resumeCompanionActive,
  clearCompanion,
} from './companion-sequence.svelte';
import {
  startDualSequence,
  resumeDualTogether,
  clearDual,
} from './dual-sequence.svelte';

const COMPANION_LAYOUTS = new Set<LayoutName>(['MEDIA_WITH_VISUAL']);
const DUAL_LAYOUTS      = new Set<LayoutName>(['DUAL_VISUAL', 'PORTRAIT_DUO']);

export interface TickerEntry {
	id:         string;
	text:       string;
	passesLeft: number;
}

export interface LowerThirdState {
	label: string;
	name:  string;
	role:  string;
}

export interface SlotChyronState {
	label:       string;
	name:        string;
	caption?:    string;
	submittedAt: number;
}

async function syncActiveAppState(): Promise<void> {
	const res = await fetch('/api/active-app/state');
	if (res.status === 204) return;
	const data = await res.json() as { layout?: LayoutName; slots?: JamSlots; timing?: JamSlotTimings; lowerThird?: LowerThirdState | null; slotChyron?: SlotChyronState | null; enrichCheckAt?: EnrichState | null };
	if (data.layout        !== undefined) serverState.jamLayout    = data.layout;
	if (data.slots         !== undefined) serverState.jamSlots     = data.slots;
	if (data.timing        !== undefined) jamModeState.slotTimings = data.timing;
	if (data.lowerThird    !== undefined) serverState.lowerThird   = data.lowerThird ?? null;
	if (data.slotChyron    !== undefined) serverState.slotChyron   = data.slotChyron ?? null;
	if (data.enrichCheckAt !== undefined) jamModeState.enrich      = data.enrichCheckAt ?? null;

	// Restore sequence state on reconnect — skip intros, resume at stable phase
	if (data.layout && data.slots) {
		if (DUAL_LAYOUTS.has(data.layout) && data.slots.visual && data.slots.visual2) {
			resumeDualTogether(data.layout, data.slots.visual, data.slots.visual2);
		} else {
			clearDual();
		}
		if (COMPANION_LAYOUTS.has(data.layout) && data.slots.visual) {
			resumeCompanionActive(data.slots.visual.id);
		} else {
			clearCompanion();
		}
	}
}

export interface JamSlots {
	loud?:    MediaItem;
	visual?:  MediaItem;
	visual2?: MediaItem;
	note?:    MediaItem;
}

interface ServerState {
	connected:   boolean;
	state:       GlobalState | null;
	jamLayout:   LayoutName | null;
	jamSlots:    JamSlots;
	lowerThird:  LowerThirdState | null;
	slotChyron:  SlotChyronState | null;
	tickerQueue: TickerEntry[];
}

export const serverState = $state<ServerState>({
	connected:   false,
	state:       null,
	jamLayout:   null,
	jamSlots:    {},
	lowerThird:  null,
	slotChyron:  null,
	tickerQueue: [],
});

let socket: Socket | null = null;

export function connectSocket(): void {
	if (socket) return;

	socket = io({ path: '/socket.io' });

	socket.on('connect', () => {
		serverState.connected = true;
		logEvent('connect');
		void syncActiveAppState();
	});

	socket.on('disconnect', () => {
		serverState.connected = false;
		logEvent('disconnect');
	});

	socket.on('state', (data: GlobalState) => {
		serverState.state = data;
		logEvent('state', data);
	});

	socket.on('jam-mode:layout', (data: { layout: LayoutName; slots: JamSlots; timing?: JamSlotTimings }) => {
		const prevLayout  = serverState.jamLayout;
		const prevVisual  = serverState.jamSlots.visual?.id;
		const prevVisual2 = serverState.jamSlots.visual2?.id;

		serverState.jamLayout    = data.layout;
		serverState.jamSlots     = data.slots;
		jamModeState.slotTimings = data.timing ?? {};

		// Trigger or clear dual sequence
		if (DUAL_LAYOUTS.has(data.layout) && data.slots.visual && data.slots.visual2) {
			const isNew = data.layout !== prevLayout ||
				data.slots.visual.id !== prevVisual ||
				data.slots.visual2.id !== prevVisual2;
			if (isNew) startDualSequence(data.layout, data.slots.visual, data.slots.visual2);
		} else {
			clearDual();
		}

		// Trigger or clear companion sequence
		if (COMPANION_LAYOUTS.has(data.layout) && data.slots.visual) {
			startCompanionIntro(data.slots.visual);
		} else {
			clearCompanion();
		}

		logEvent('jam-mode:layout', data);
	});

	socket.on('jam-mode:enrich', (data: EnrichState | null) => {
		jamModeState.enrich = data ?? null;
		logEvent('jam-mode:enrich', data ?? undefined);
	});

	socket.on('jam-mode:lower-third:show', (data: LowerThirdState) => {
		serverState.lowerThird = data;
		logEvent('jam-mode:lower-third:show', data);
	});

	socket.on('jam-mode:lower-third:hide', () => {
		serverState.lowerThird = null;
		logEvent('jam-mode:lower-third:hide');
	});

	socket.on('jam-mode:slot-chyron:show', (data: SlotChyronState) => {
		serverState.slotChyron = data;
		logEvent('jam-mode:slot-chyron:show', data);
	});

	socket.on('jam-mode:slot-chyron:hide', () => {
		serverState.slotChyron = null;
		logEvent('jam-mode:slot-chyron:hide');
	});

	socket.on('pool:item:ready', () => {
		void fetchPoolItems();
	});

	socket.on('jam-mode:ticker:add', (item: MediaItem) => {
		if (serverState.tickerQueue.some(e => e.id === item.id)) return;
		const text = (item.content as TickerContent).text;
		serverState.tickerQueue.push({ id: item.id, text, passesLeft: 3 });
		logEvent('jam-mode:ticker:add', item);
	});

	socket.on('broadcast:reload', () => {
		location.reload();
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

