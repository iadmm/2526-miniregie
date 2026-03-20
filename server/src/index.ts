import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

// Import DB to trigger migrations and seed on startup (side effects)
import './db/index.js';

import { PoolManager } from "./pool";
import { BroadcastManager } from "./broadcast";

import authRouter            from './routes/auth.js';
import createApiRouter       from './routes/api.js';
import createGoRouter        from './routes/go.js';
import createScheduleRouter  from './routes/schedule.js';
import createQueueRouter     from './routes/queue.js';

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*' }, // restrict in production
});

app.use(express.json());

// ─── Core services ────────────────────────────────────────────────────────────

// Deferred reference breaks the circular dependency:
// pool needs getJamState → broadcast, broadcast needs pool.
// getJamState is only called lazily (never during construction).
let broadcastRef!: BroadcastManager;

const pool = new PoolManager({
  getJamState: () => broadcastRef.getState().jam,
});

const broadcast = new BroadcastManager({ io, pool });
broadcastRef = broadcast;

// ─── Static file serving ──────────────────────────────────────────────────────

const UPLOAD_DIR = process.env['UPLOAD_DIR'] ?? './uploads';
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/admin',   express.static('client/admin/dist'));
app.use('/go',      express.static('client/go/dist'));
app.use('/',        express.static('client/broadcast/dist'));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/auth',          authRouter);
app.use('/api',           createApiRouter(broadcast, pool));
app.use('/api/schedule',  createScheduleRouter(broadcast));
app.use('/api/queue',     createQueueRouter(pool));
// Mount participant API at /go/api so it doesn't conflict with the static /go SPA
app.use('/go/api',        createGoRouter(broadcast, pool));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ─── Heartbeat for broadcast client watchdog ──────────────────────────────────

io.on('connection', (socket) => {
  console.log(`client connected: ${socket.id}`);

  const pingInterval = setInterval(() => {
    socket.emit('ping');
  }, 10_000);

  // jam-mode client reports its current on-air state so the admin can observe it
  socket.on('jam:state-update', (data: unknown) => {
    if (
      typeof data === 'object' && data !== null &&
      'activeItemIds' in data && Array.isArray((data as Record<string, unknown>)['activeItemIds']) &&
      'regime' in data && typeof (data as Record<string, unknown>)['regime'] === 'string'
    ) {
      const raw = data as { activeItemIds: unknown[]; regime: string };
      const ids = raw.activeItemIds.filter((x): x is string => typeof x === 'string');
      const regime = raw.regime === 'hold' ? 'hold' : raw.regime === 'buffer' ? 'buffer' : 'normal';
      broadcast.updateJamMode(ids, regime);
    }
  });

  socket.on('pool:mark', (data: { itemId: string; event: string; payload?: Record<string, unknown> }) => {
    const { itemId, event, payload } = data;
    console.log(`pool:mark — ${event} itemId=${itemId}`);

    switch (event) {
      case 'displayed':
        pool.markDisplayed(itemId, socket.id);
        break;
      case 'skipped':
        pool.markSkipped(itemId, socket.id);
        break;
      case 'held': {
        const durationMs = typeof payload?.['duration'] === 'number' ? payload['duration'] : 0;
        pool.markHeld(itemId, socket.id, durationMs);
        break;
      }
      default:
        // Silently ignore unknown mark events
        break;
    }
  });

  socket.on('disconnect', () => {
    clearInterval(pingInterval);
    console.log(`client disconnected: ${socket.id}`);
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  broadcast.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  broadcast.destroy();
  process.exit(0);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env['PORT'] ?? 3000;
httpServer.listen(PORT, () => {
  console.log(`MiniRégie server running on http://localhost:${PORT}`);
});