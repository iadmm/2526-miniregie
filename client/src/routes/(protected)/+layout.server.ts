import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.participant) redirect(302, '/login');
	if (!locals.participant.avatarUrl && url.pathname !== '/onboarding') redirect(302, '/onboarding');
	return {
		participant: locals.participant,
	};
};

