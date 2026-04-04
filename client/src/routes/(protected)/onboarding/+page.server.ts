import { fail, redirect } from '@sveltejs/kit';
import { COOKIE_NAME, COOKIE_TTL_SECS } from '@shared/session';
import type { Actions } from './$types';

export const actions: Actions = {
	logout: async ({ cookies }) => {
		cookies.delete(COOKIE_NAME, { path: '/' });
		redirect(302, '/login');
	},

	avatar: async ({ request, fetch, cookies }) => {
		let fd: FormData;
		try {
			fd = await request.formData();
		} catch {
			return fail(413, { error: 'Fichier trop volumineux. Maximum : 5 Mo.' });
		}
		const token = cookies.get(COOKIE_NAME) ?? '';
		const res   = await fetch('/go/api/onboarding/avatar', {
			method:  'POST',
			body:    fd,
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await res.json() as { error?: string; token?: string };
		if (!res.ok) return fail(res.status, { error: data.error ?? 'Upload failed' });
		// Express returns a refreshed token with the updated avatarUrl
		if (data.token) {
			cookies.set(COOKIE_NAME, data.token, {
				httpOnly: true,
				sameSite: 'lax',
				maxAge:   COOKIE_TTL_SECS,
				path:     '/',
			});
		}
		redirect(302, '/');
	},
};
