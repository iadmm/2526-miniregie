import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { PoolManager, GetMainFilters, GetPlayedFilters } from '../pool/index.js';
import type { MediaType } from '../../../shared/types.js';

// Comma-separated ?types=photo,note → ['photo', 'note']
function parseTypeList(raw: unknown): MediaType[] | undefined {
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  return raw.split(',').map(s => s.trim() as MediaType);
}

export default function createQueueRouter(pool: PoolManager): Router {
  const router = Router();

  router.use(requireAuth, requireRole('admin'));

  /**
   * GET /api/queue/main
   * Returns queue.main: ready items with explicit positions, sorted by position.
   * Optional query: ?types=photo,note  ?excludeTypes=ticker
   */
  router.get('/main', (req, res) => {
    const { types, excludeTypes } = req.query as { types?: unknown; excludeTypes?: unknown };
    const filters: GetMainFilters = {};
    const parsedTypes        = parseTypeList(types);
    const parsedExcludeTypes = parseTypeList(excludeTypes);
    if (parsedTypes)        filters.types        = parsedTypes;
    if (parsedExcludeTypes) filters.excludeTypes = parsedExcludeTypes;
    res.json(pool.getMain(filters));
  });

  /**
   * GET /api/queue/played
   * Returns queue.played: played items sorted by playedAt DESC.
   * Optional query: ?types=photo,clip
   */
  router.get('/played', (req, res) => {
    const { types } = req.query as { types?: unknown };
    const filters: GetPlayedFilters = {};
    const parsedTypes = parseTypeList(types);
    if (parsedTypes) filters.types = parsedTypes;
    res.json(pool.getPlayed(filters));
  });

  /**
   * POST /api/queue/reorder
   * Body: { ids: string[] }
   * Reassigns queue_position for every item in queue.main in the given order.
   * ids must contain exactly the same IDs as queue.main.
   */
  router.post('/reorder', (req, res) => {
    const { ids } = req.body as { ids?: unknown };

    if (
      !Array.isArray(ids) ||
      ids.some(id => typeof id !== 'string')
    ) {
      res.status(400).json({ error: 'ids must be an array of strings' });
      return;
    }

    try {
      pool.reorder(ids as string[]);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'reorder failed' });
    }
  });

  /**
   * POST /api/queue/:id/replay
   * Moves a played item back to the end of queue.main with a 'replayed' event.
   */
  router.post('/:id/replay', (req, res) => {
    const { id } = req.params as { id: string };

    try {
      pool.replay(id);
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const status = /not found/i.test(msg) ? 404 : 400;
      res.status(status).json({ error: msg || 'replay failed' });
    }
  });

  return router;
}
