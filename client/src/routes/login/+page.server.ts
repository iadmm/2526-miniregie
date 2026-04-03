import { fail, redirect } from '@sveltejs/kit';
import { COOKIE_NAME, COOKIE_TTL_SECS } from '@shared/session';
import type { Actions } from './$types';
import type { Participant } from '@shared/types';

function setCookie(cookies: Parameters<Actions['signin']>[0]['cookies'], token: string): void {
	cookies.set(COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: 'lax',
		maxAge:   COOKIE_TTL_SECS,
		path:     '/',
	});
}

export const actions: Actions = {
	signin: async ({ request, fetch, cookies }) => {
		const fd = await request.formData();
		const username = String(fd.get('username') ?? '').trim().toLowerCase();
		const password = String(fd.get('password') ?? '');

		if (!username || !password) {
			return fail(400, { action: 'signin', error: 'Username and password are required.' });
		}

		const res = await fetch('/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password }),
		});

		const data = await res.json() as { error?: string; token?: string; participant?: Participant };

		if (!res.ok) {
			return fail(res.status, { action: 'signin', error: data.error ?? 'Sign in failed.' });
		}

		setCookie(cookies, data.token!);
		redirect(302, data.participant?.avatarUrl ? '/' : '/onboarding');
	},

	register: async ({ request, fetch, cookies }) => {
		const fd = await request.formData();
		const username    = String(fd.get('username') ?? '').trim().toLowerCase();
		const displayName = String(fd.get('displayName') ?? '').trim();
		const team        = String(fd.get('team') ?? '').trim();
		const password    = String(fd.get('password') ?? '');

		if (!username || !displayName || !password) {
			return fail(400, { action: 'register', error: 'Username, display name and password are required.' });
		}

		const res = await fetch('/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, displayName, team, password }),
		});

		const data = await res.json() as { error?: string; token?: string };

		if (!res.ok) {
			return fail(res.status, { action: 'register', error: data.error ?? 'Registration failed.' });
		}

		setCookie(cookies, data.token!);
		redirect(302, '/onboarding');
	},
};
