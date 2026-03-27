export { KNOWN_APPS } from '@shared/types';
export type AtType = 'H+' | 'T-' | 'absolute';

export function parseAt(at: string): { type: AtType; value: string } {
	if (at.startsWith('H+')) return { type: 'H+', value: at.slice(2) };
	if (at.startsWith('T-')) return { type: 'T-', value: at.slice(2) };
	return { type: 'absolute', value: at };
}

export function buildAt(type: AtType, value: string): string {
	if (type === 'H+') return `H+${value}`;
	if (type === 'T-') return `T-${value}`;
	try {
		return new Date(value).toISOString();
	} catch {
		return value;
	}
}

export function resolveAt(
	at: string,
	jam: { startedAt: number | null; endsAt: number | null } | null,
): string | null {
	try {
		let ts: number;
		if (at.startsWith('H+')) {
			if (!jam?.startedAt) return null;
			const p = at.slice(2).split(':').map(Number);
			ts = jam.startedAt + ((p[0] * 60 + p[1]) * 60 + (p[2] ?? 0)) * 1000;
		} else if (at.startsWith('T-')) {
			if (!jam?.endsAt) return null;
			const p = at.slice(2).split(':').map(Number);
			ts = jam.endsAt - ((p[0] * 60 + p[1]) * 60 + (p[2] ?? 0)) * 1000;
		} else {
			ts = new Date(at).getTime();
		}
		if (isNaN(ts)) return null;
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} catch {
		return null;
	}
}