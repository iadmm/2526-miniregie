import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getScheduleEntries,
  insertScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  clearScheduleEntries,
} from '../db/queries.js';
import { seedSchedule } from '../db/index.js';
import type { BroadcastManager } from '../broadcast/index.js';
import type { ScheduleEntryStatus } from '../../../shared/types.js';

const VALID_STATUSES: ScheduleEntryStatus[] = ['pending', 'fired', 'skipped'];

export default function createScheduleRouter(broadcast: BroadcastManager): Router {
  const router = Router();

  // All schedule routes require admin role
  router.use(requireAuth, requireRole('admin'));

  /**
   * GET /api/schedule
   * Returns the full schedule (all statuses — timeline view for admin UI).
   */
  router.get('/', (_req, res) => {
    res.json(getScheduleEntries());
  });

  /**
   * POST /api/schedule
   * Body: { at: string, app: string, label?: string }
   * Adds a new schedule entry and triggers a schedule reload.
   */
  router.post('/', (req, res) => {
    const { at, app, label } = req.body as { at?: unknown; app?: unknown; label?: unknown };

    if (typeof at !== 'string' || at.trim().length === 0) {
      res.status(400).json({ error: 'at is required (e.g. "H+00:10:00", "T-04:00:00", ISO timestamp)' });
      return;
    }
    if (typeof app !== 'string' || app.trim().length === 0) {
      res.status(400).json({ error: 'app is required' });
      return;
    }

    const entry = insertScheduleEntry(
      at.trim(),
      app.trim(),
      typeof label === 'string' && label.trim().length > 0 ? label.trim() : undefined,
    );
    broadcast.reloadSchedule();
    res.status(201).json(entry);
  });

  /**
   * PUT /api/schedule/:id
   * Body: { at?, app?, label?, status? }
   * Updates an existing entry. Caller is responsible for only updating
   * pending entries; the route itself does not enforce this to allow
   * admin corrections (e.g. correcting a misfired trigger label).
   */
  router.put('/:id', (req, res) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'id must be a number' });
      return;
    }

    const { at, app, label, status } = req.body as {
      at?:     unknown;
      app?:    unknown;
      label?:  unknown;
      status?: unknown;
    };

    const patch: Parameters<typeof updateScheduleEntry>[1] = {};

    if (at !== undefined) {
      if (typeof at !== 'string' || at.trim().length === 0) {
        res.status(400).json({ error: 'at must be a non-empty string' });
        return;
      }
      patch.at = at.trim();
    }

    if (app !== undefined) {
      if (typeof app !== 'string' || app.trim().length === 0) {
        res.status(400).json({ error: 'app must be a non-empty string' });
        return;
      }
      patch.app = app.trim();
    }

    if (label !== undefined) {
      // null clears the label, string sets it
      if (label !== null && typeof label !== 'string') {
        res.status(400).json({ error: 'label must be a string or null' });
        return;
      }
      patch.label = label === null ? null : (label as string).trim() || null;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as ScheduleEntryStatus)) {
        res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
        return;
      }
      patch.status = status as ScheduleEntryStatus;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'at least one field to update is required (at, app, label, status)' });
      return;
    }

    updateScheduleEntry(id, patch);
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  /**
   * DELETE /api/schedule/:id
   * Deletes a schedule entry. Only pending entries should be deleted
   * (the client is expected to enforce this, but the server does not
   * block deletions of fired entries to allow admin cleanup).
   */
  router.delete('/:id', (req, res) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'id must be a number' });
      return;
    }

    deleteScheduleEntry(id);
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  /**
   * POST /api/schedule/reload
   * Triggers a schedule reload from DB without modifying data.
   * Useful after external DB changes or for admin debugging.
   */
  router.post('/reload', (_req, res) => {
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  /**
   * POST /api/schedule/reseed
   * Clears all schedule entries and re-seeds from config/schedule.json.
   */
  router.post('/reseed', (_req, res) => {
    clearScheduleEntries();
    seedSchedule();
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  return router;
}
