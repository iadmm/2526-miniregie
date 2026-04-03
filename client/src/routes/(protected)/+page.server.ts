import { fail, redirect } from '@sveltejs/kit';
import { COOKIE_NAME } from '@shared/session';
import type { PageServerLoad, Actions } from './$types';
import type { MediaItem } from '@shared/types';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
	const token = cookies.get(COOKIE_NAME) ?? '';
	const res = await fetch('/go/api/status', {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) return { jamStatus: 'idle' as const, myItems: [] };
	const data = await res.json() as { jamStatus: 'idle' | 'running' | 'ended'; myItems: MediaItem[] };
	return { jamStatus: data.jamStatus, myItems: data.myItems };
}

export const actions: Actions = {
	logout: async ({ cookies }) => {
		cookies.delete(COOKIE_NAME, { path: '/' });
		redirect(302, '/login');
	},

	submit: async ({ request, fetch, cookies }) => {
		const fd    = await request.formData();
		const token = cookies.get(COOKIE_NAME) ?? '';
		const res   = await fetch('/go/api/submit', {
			method:  'POST',
			body:    fd,
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await res.json() as { error?: string; item?: unknown };
		if (!res.ok) return fail(res.status, { error: data.error ?? 'Submission failed' });
		return { success: true, item: data.item };
	},
};
