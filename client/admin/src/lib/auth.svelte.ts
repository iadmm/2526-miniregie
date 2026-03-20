import { api } from './api.ts';
import type { Participant } from '@shared/types';

// ─── Reactive auth state ──────────────────────────────────────────────────────

export const auth = $state<{
  status: 'checking' | 'login' | 'ready';
  participant: Participant | null;
}>({
  status: 'checking',
  participant: null,
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function checkSession(): Promise<void> {
  try {
    const { participant } = await api.auth.me();
    auth.participant = participant;
    auth.status = 'ready';
  } catch {
    auth.status = 'login';
  }
}

export async function login(username: string, password: string): Promise<void> {
  const { participant } = await api.auth.login(username, password);
  auth.participant = participant;
  auth.status = 'ready';
}

export async function logout(): Promise<void> {
  await api.auth.logout();
  auth.participant = null;
  auth.status = 'login';
}
