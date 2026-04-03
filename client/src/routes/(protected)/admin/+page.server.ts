import { redirect } from '@sveltejs/kit';
import { COOKIE_NAME } from '@shared/session';
import type { PageServerLoad, Actions } from './$types';
import type { ScheduleEntry, MediaItem } from '@shared/types';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
	const token = cookies.get(COOKIE_NAME) ?? '';
	const headers = { Authorization: `Bearer ${token}` };

	const [scheduleRes, itemsRes] = await Promise.all([
		fetch('/api/schedule', { headers }),
		fetch('/api/items', { headers }),
	]);

	const scheduleEntries: ScheduleEntry[] = scheduleRes.ok ? await scheduleRes.json() : [];
	const poolItems: MediaItem[] = itemsRes.ok ? await itemsRes.json() : [];

	return { scheduleEntries, poolItems, token };
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		cookies.delete(COOKIE_NAME, { path: '/' });
		redirect(302, '/login');
	},
};