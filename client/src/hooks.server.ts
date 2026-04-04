import {COOKIE_NAME} from '@shared/session';
import type {Handle} from '@sveltejs/kit';
import type {Participant} from '@shared/types';

const API_BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.participant = null;

	const token = event.cookies.get(COOKIE_NAME);
	if (token) {
		try {
			const res = await fetch(`${API_BASE}/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const data = await res.json() as { participant: Participant };
				event.locals.participant = data.participant;
			}
		} catch {
			// Network error — leave participant null
		}
	}

	return resolve(event);
};