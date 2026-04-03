import { COOKIE_NAME, parseSession } from '@shared/session';
import { COOKIE_SECRET } from '$env/static/private';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.participant = null;

	const token = event.cookies.get(COOKIE_NAME);
	if (token) {
		event.locals.participant = await parseSession(token, COOKIE_SECRET);
	}

	return resolve(event);
};
