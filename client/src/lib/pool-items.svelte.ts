import type { MediaItem } from '@shared/types';

const STATUS_RANK: Record<MediaItem['status'], number> = {
	ready:   0,
	pending: 1,
	played:  2,
	evicted: 3,
};

export interface PoolItemsState {
	items: MediaItem[];
	loading: boolean;
	error: string | null;
}

export const poolItems = $state<PoolItemsState>({
	items: [],
	loading: false,
	error: null,
});

export async function fetchPoolItems(): Promise<void> {
	poolItems.loading = true;
	poolItems.error = null;
	try {
		const res = await fetch('/api/items');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const raw = (await res.json()) as MediaItem[];
		poolItems.items = raw.sort((a, b) => {
			const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
			if (byStatus !== 0) return byStatus;
			// Within ready: queue position ASC
			if (a.status === 'ready') return (a.queuePosition ?? 999) - (b.queuePosition ?? 999);
			// Others: most recent first
			return b.submittedAt - a.submittedAt;
		});
	} catch (e) {
		poolItems.error = String(e);
	} finally {
		poolItems.loading = false;
	}
}

export function contentPreview(item: MediaItem): string {
	const c = item.content as Record<string, unknown>;
	if ('text' in c && typeof c.text === 'string') return c.text.slice(0, 100);
	if ('title' in c && typeof c.title === 'string') return c.title.slice(0, 100);
	if ('url' in c && typeof c.url === 'string') return (c.url as string).slice(0, 100);
	if ('segments' in c) return `${(c.segments as unknown[]).length} segment(s)`;
	return '—';
}

export function formatSubmittedAt(ts: number): string {
	return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}