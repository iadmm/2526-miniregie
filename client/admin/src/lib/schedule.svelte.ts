import type { ScheduleEntry } from '@shared/types';
import { api } from './api.ts';

export const scheduleState = $state<{
  entries: ScheduleEntry[];
  loading: boolean;
  error: string | null;
}>({ entries: [], loading: false, error: null });

export async function refreshSchedule(): Promise<void> {
  scheduleState.loading = true;
  scheduleState.error = null;
  try {
    scheduleState.entries = await api.schedule.list();
  } catch (e) {
    scheduleState.error = e instanceof Error ? e.message : 'Failed to load schedule';
  } finally {
    scheduleState.loading = false;
  }
}
