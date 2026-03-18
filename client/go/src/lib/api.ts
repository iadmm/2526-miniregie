import type { Participant, MediaItem } from '@shared/types.js';

// ─── Error type ───────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  error: string;
}

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export { isApiError };

// ─── Base fetch helper ────────────────────────────────────────────────────────

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...options,
    });
  } catch {
    throw { status: 0, error: 'Connexion perdue. Réessaie.' } satisfies ApiError;
  }

  if (!res.ok) {
    let errorMessage = `Erreur ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (typeof body.error === 'string') errorMessage = body.error;
    } catch {
      // ignore JSON parse error, use generic message
    }
    throw { status: res.status, error: errorMessage } satisfies ApiError;
  }

  // 204 No Content — return empty object
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}

async function requestJson<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  return request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function requestFormData<T>(url: string, formData: FormData): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser sets it with boundary automatically
  });
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login(username: string, password: string): Promise<{ participant: Participant }> {
      return requestJson('/auth/login', { username, password });
    },

    register(
      username: string,
      displayName: string,
      team: string,
      password: string,
    ): Promise<{ participant: Participant }> {
      return requestJson('/auth/register', { username, displayName, team, password });
    },

    logout(): Promise<void> {
      return request<void>('/auth/logout', { method: 'POST' });
    },

    async me(): Promise<{ participant: Participant } | null> {
      try {
        return await request<{ participant: Participant }>('/auth/me');
      } catch (e) {
        // 401 = not logged in — not an exceptional error
        if (isApiError(e) && e.status === 401) return null;
        throw e;
      }
    },
  },

  go: {
    teams(): Promise<string[]> {
      return request<string[]>('/go/api/teams');
    },

    status(): Promise<{ jamStatus: string; myItems: MediaItem[] }> {
      return request<{ jamStatus: string; myItems: MediaItem[] }>('/go/api/status');
    },

    submitNote(text: string): Promise<{ item: MediaItem }> {
      const fd = new FormData();
      fd.append('type', 'note');
      fd.append('text', text);
      return requestFormData('/go/api/submit', fd);
    },

    submitPhoto(file: File, caption?: string): Promise<{ item: MediaItem }> {
      const fd = new FormData();
      fd.append('type', 'photo');
      fd.append('file', file);
      if (caption !== undefined && caption.trim() !== '') fd.append('caption', caption);
      return requestFormData('/go/api/submit', fd);
    },

    submitClip(file: File, caption?: string): Promise<{ item: MediaItem }> {
      const fd = new FormData();
      fd.append('type', 'clip');
      fd.append('file', file);
      if (caption !== undefined && caption.trim() !== '') fd.append('caption', caption);
      return requestFormData('/go/api/submit', fd);
    },

    submitLink(url: string, caption?: string): Promise<{ item: MediaItem }> {
      const fd = new FormData();
      fd.append('type', 'link');
      fd.append('url', url);
      if (caption !== undefined && caption.trim() !== '') fd.append('caption', caption);
      return requestFormData('/go/api/submit', fd);
    },

    uploadAvatar(file: File): Promise<{ participant: Participant }> {
      const fd = new FormData();
      fd.append('avatar', file);
      return requestFormData('/go/api/onboarding/avatar', fd);
    },
  },
};