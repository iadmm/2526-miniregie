import type { MediaItem } from '@shared/types';

interface SubmissionsState {
	items: MediaItem[];
	jamStatus: 'idle' | 'running' | 'ended';
	loading: boolean;
}

export const submissions = $state<SubmissionsState>({
	items: [],
	jamStatus: 'idle',
	loading: false,
});

export async function loadMyItems(): Promise<void> {
	submissions.loading = true;
	try {
		const res = await fetch('/go/api/status');
		if (!res.ok) return;
		const data = (await res.json()) as {
			jamStatus: 'idle' | 'running' | 'ended';
			myItems: MediaItem[];
		};
		console.log("data", data);
		submissions.jamStatus = data.jamStatus;
		submissions.items = data.myItems;
	} finally {
		submissions.loading = false;
	}
}
