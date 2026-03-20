import type { MediaStatus, AppId, Participant, MediaItem, ScoredMediaItem, GlobalState, LimitTrigger, JamConfig, ScheduleEntry, AuthorStats } from '@shared/types';

// ─── Error type ───────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  error: string;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    let error = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) error = body.error;
    } catch {
      // ignore parse error
    }
    throw { status: res.status, error } satisfies ApiError;
  }

  // 204 No Content or empty body
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me(): Promise<{ participant: Participant }> {
      return request('/auth/me');
    },

    login(username: string, password: string): Promise<{ participant: Participant }> {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },

    logout(): Promise<{ ok: boolean }> {
      return request('/auth/logout', { method: 'POST' });
    },
  },

  config: {
    get(): Promise<JamConfig> {
      return request('/api/config');
    },
    update(patch: Partial<JamConfig>): Promise<JamConfig> {
      return request('/api/config', { method: 'PATCH', body: JSON.stringify(patch) });
    },
  },

  jam: {
    start(endsAt?: number): Promise<{ ok: boolean }> {
      return request('/api/jam/start', {
        method: 'POST',
        body: JSON.stringify(endsAt !== undefined ? { endsAt } : {}),
      });
    },

    end(): Promise<{ ok: boolean }> {
      return request('/api/jam/end', { method: 'POST' });
    },

    panic(): Promise<{ ok: boolean }> {
      return request('/api/jam/panic', { method: 'POST' });
    },

    clearPanic(resumeAppId: AppId): Promise<{ ok: boolean }> {
      return request('/api/jam/panic', {
        method: 'DELETE',
        body: JSON.stringify({ resumeAppId }),
      });
    },

    reset(): Promise<{ ok: boolean }> {
      return request('/api/jam/reset', { method: 'POST' });
    },
  },

  participants: {
    list(q?: string): Promise<Participant[]> {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const qs = params.toString();
      return request(`/api/participants${qs ? `?${qs}` : ''}`);
    },

    setAdmin(id: string, admin: boolean): Promise<{ ok: boolean }> {
      return request(`/api/participants/${encodeURIComponent(id)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ admin }),
      });
    },

    ban(id: string, reason?: string): Promise<{ ok: boolean }> {
      return request(`/api/participants/${encodeURIComponent(id)}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },

    unban(id: string): Promise<{ ok: boolean }> {
      return request(`/api/participants/${encodeURIComponent(id)}/ban`, {
        method: 'DELETE',
      });
    },
  },

  state: {
    get(): Promise<GlobalState> {
      return request('/api/state');
    },
  },

  broadcast: {
    dispatch(appId: AppId): Promise<{ ok: boolean }> {
      return request('/api/broadcast/dispatch', {
        method: 'POST',
        body: JSON.stringify({ appId }),
      });
    },

    schedule(): Promise<LimitTrigger[]> {
      return request('/api/broadcast/schedule');
    },
  },

  schedule: {
    list(): Promise<ScheduleEntry[]> {
      return request('/api/schedule');
    },

    create(payload: { at: string; app: string; label?: string }): Promise<ScheduleEntry> {
      return request('/api/schedule', { method: 'POST', body: JSON.stringify(payload) });
    },

    update(id: number, patch: { at?: string; app?: string; label?: string | null; status?: string }): Promise<{ ok: boolean }> {
      return request(`/api/schedule/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    },

    delete(id: number): Promise<{ ok: boolean }> {
      return request(`/api/schedule/${id}`, { method: 'DELETE' });
    },

    reload(): Promise<{ ok: boolean }> {
      return request('/api/schedule/reload', { method: 'POST' });
    },
  },

  pool: {
    authors(): Promise<AuthorStats[]> {
      return request('/api/pool/authors');
    },
  },

  items: {
    list(filters?: { status?: MediaStatus; authorId?: string; scored?: boolean }): Promise<MediaItem[] | ScoredMediaItem[]> {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.authorId) params.set('authorId', filters.authorId);
      if (filters?.scored) params.set('scored', 'true');
      const qs = params.toString();
      return request(`/api/items${qs ? `?${qs}` : ''}`);
    },

    create(payload: { type: 'note' | 'ticker'; text: string; label?: string; pinned?: boolean }): Promise<MediaItem> {
      return request('/api/items/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    updateStatus(id: string, status: MediaStatus): Promise<{ ok: boolean }> {
      return request(`/api/items/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    updatePin(id: string, pinned: boolean): Promise<{ ok: boolean }> {
      return request(`/api/items/${encodeURIComponent(id)}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned }),
      });
    },

    delete(id: string): Promise<{ ok: boolean }> {
      return request(`/api/items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },
};