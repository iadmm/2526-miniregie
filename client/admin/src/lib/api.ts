import type { MediaStatus, AppId, Participant, MediaItem, GlobalState } from '@shared/types';

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

  jam: {
    start(endsAt: number): Promise<{ ok: boolean }> {
      return request('/api/jam/start', {
        method: 'POST',
        body: JSON.stringify({ endsAt }),
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
  },

  items: {
    list(filters?: { status?: MediaStatus; authorId?: string }): Promise<MediaItem[]> {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.authorId) params.set('authorId', filters.authorId);
      const qs = params.toString();
      return request(`/api/items${qs ? `?${qs}` : ''}`);
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

  participants: {
    list(q?: string): Promise<Participant[]> {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const qs = params.toString();
      return request(`/api/participants${qs ? `?${qs}` : ''}`);
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
};