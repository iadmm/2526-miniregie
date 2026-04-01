// broadcast-log — reactive store for socket events received by the broadcast client.
// Consumed by BroadcastLog.svelte in the admin.

export type LogKind = 'show' | 'hide' | 'info' | 'warn';

export interface LogEntry {
	id:      number;
	ts:      number;
	event:   string;   // shortened display name
	summary: string;   // payload summary
	kind:    LogKind;
}

const MAX_ENTRIES = 80;
let seq = 0;

export const broadcastLog = $state<{ entries: LogEntry[] }>({ entries: [] });

export function logEvent(rawEvent: string, payload?: unknown): void {
	broadcastLog.entries = [
		{
			id:      seq++,
			ts:      Date.now(),
			event:   shorten(rawEvent),
			summary: summarize(rawEvent, payload),
			kind:    kindOf(rawEvent),
		},
		...broadcastLog.entries.slice(0, MAX_ENTRIES - 1),
	];
}

export function clearLog(): void {
	broadcastLog.entries = [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_MAP: Record<string, string> = {
	'connect':                   'connect',
	'disconnect':                'disconnect',
	'state':                     'state',
	'jam-mode:layout':           'layout',
	'jam-mode:enrich':           'enrich',
	'jam-mode:lower-third:show': 'lt:show',
	'jam-mode:lower-third:hide': 'lt:hide',
	'jam-mode:slot-chyron:show': 'chyron:show',
	'jam-mode:slot-chyron:hide': 'chyron:hide',
};

function shorten(rawEvent: string): string {
	return EVENT_MAP[rawEvent] ?? rawEvent;
}

function kindOf(rawEvent: string): LogKind {
	if (rawEvent.endsWith(':show'))  return 'show';
	if (rawEvent.endsWith(':hide'))  return 'hide';
	if (rawEvent === 'disconnect')   return 'warn';
	return 'info';
}

function summarize(rawEvent: string, payload: unknown): string {
	if (payload === undefined || payload === null) return '';
	const p = payload as Record<string, unknown>;

	switch (rawEvent) {
		case 'state': {
			const status = (p.jam as Record<string, unknown> | undefined)?.status;
			return status ? `jam=${status}` : '';
		}
		case 'jam-mode:layout': {
			const layout = p.layout as string ?? '';
			const slots  = (p.slots ?? {}) as Record<string, unknown>;
			const active = Object.keys(slots).filter(k => slots[k]);
			return active.length ? `${layout}  [${active.join(' · ')}]` : layout;
		}
		case 'jam-mode:lower-third:show': {
			const d = p as { label?: string; name?: string; role?: string };
			return [d.name, d.role].filter(Boolean).join('  ');
		}
		case 'jam-mode:slot-chyron:show': {
			const d = p as { label?: string; name?: string };
			return [d.label, d.name].filter(Boolean).join('  ·  ');
		}
		case 'jam-mode:enrich': {
			const ms = p.intervalMs as number | undefined;
			return ms != null ? `+${Math.round(ms / 1000)}s` : '';
		}
		default:
			return '';
	}
}
