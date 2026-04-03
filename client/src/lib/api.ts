import { get } from 'svelte/store';
import { page } from '$app/stores';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
	const token = (get(page).data as { token?: string }).token ?? '';
	return { Authorization: `Bearer ${token}`, ...extra };
}

export async function apiFetch(
	method: string,
	path: string,
	body?: unknown,
): Promise<{ ok: boolean; error: string | null }> {
	try {
		const hasBody = body !== undefined;
		const res = await fetch(path, {
			method,
			headers: authHeaders(hasBody ? { 'Content-Type': 'application/json' } : undefined),
			body: hasBody ? JSON.stringify(body) : undefined,
		});
		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			return { ok: false, error: data.error ?? `HTTP ${res.status}` };
		}
		return { ok: true, error: null };
	} catch (e) {
		return { ok: false, error: String(e) };
	}
}