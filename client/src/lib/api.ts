import { get } from 'svelte/store';
import { page } from '$app/stores';
import type { ScheduleEntry, ScheduleEntryStatus, AppId } from '@shared/types';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
	const token = (get(page).data as { token?: string }).token ?? '';
	return { Authorization: `Bearer ${token}`, ...extra };
}

export async function apiFetch<T = never>(
	method: string,
	path: string,
	body?: unknown,
): Promise<{ ok: boolean; data: T | null; error: string | null }> {
	try {
		const hasBody = body !== undefined;
		const res = await fetch(path, {
			method,
			headers: authHeaders(hasBody ? { 'Content-Type': 'application/json' } : undefined),
			body: hasBody ? JSON.stringify(body) : undefined,
		});
		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			return { ok: false, data: null, error: data.error ?? `HTTP ${res.status}` };
		}
		const contentType = res.headers.get('content-type') ?? '';
		const data = contentType.includes('application/json') ? (await res.json()) as T : null;
		return { ok: true, data, error: null };
	} catch (e) {
		return { ok: false, data: null, error: String(e) };
	}
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export const getSchedule = () =>
	apiFetch<ScheduleEntry[]>('GET', '/api/schedule');

export const createScheduleEntry = (data: { at: string; app: AppId; label?: string }) =>
	apiFetch<ScheduleEntry>('POST', '/api/schedule', data);

export const updateScheduleEntry = (
	id: number,
	patch: { at?: string; app?: AppId; label?: string | null; status?: ScheduleEntryStatus },
) => apiFetch<ScheduleEntry>('PUT', `/api/schedule/${id}`, patch);

export const deleteScheduleEntry = (id: number) =>
	apiFetch('DELETE', `/api/schedule/${id}`);

export const reseedSchedule = () =>
	apiFetch('POST', '/api/schedule/reseed');

// ─── Broadcast ────────────────────────────────────────────────────────────────

export const dispatchBroadcast = (appId: AppId) =>
	apiFetch('POST', '/api/broadcast/dispatch', { appId });

export const reloadConfig = () =>
	apiFetch('POST', '/api/config/reload');