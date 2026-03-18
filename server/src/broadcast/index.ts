import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { shouldFire, parseScheduleEntry } from './triggers.js';
import { validateJamTransition } from './jam-state.js';
import { insertBroadcastEvent } from '../db/queries.js';
import type { GlobalState, LimitTrigger, MarketTrigger, AppId, JamStatus } from '../../../shared/types.js';
import type { PoolManager } from '../pool/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleEntry {
  at:       string;
  app?:     string;
  trigger?: string;
}

interface PersistedState {
  jam:       GlobalState['jam'];
  activeApp: AppId;
  schedule:  LimitTrigger[];
}

const STATE_FILE        = 'state.json';
const TICK_MS           = 1_000;
const PERSIST_MS        = 30_000;
const TRANSITION_ACK_MS = 3_000;

// ─── BroadcastManager ─────────────────────────────────────────────────────────

export class BroadcastManager {
  private state:    GlobalState;
  private schedule: LimitTrigger[];

  private readonly io:   Server;
  private readonly pool: PoolManager;

  private tickInterval:    ReturnType<typeof setInterval> | null = null;
  private persistInterval: ReturnType<typeof setInterval> | null = null;

  // Transition coordination
  private isTransitioning              = false;
  private triggerQueue:                MarketTrigger[] = [];
  private pendingTransitionResolve:    (() => void) | null = null;

  constructor(options: { io: Server; pool: PoolManager; scheduleFile: string }) {
    this.io   = options.io;
    this.pool = options.pool;

    this.schedule = this.loadSchedule(options.scheduleFile);
    this.state    = this.loadOrInitState();

    this.setupSocketHandlers();
    this.setupPoolListeners();
    this.startTick();
    this.startPersist();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  dispatch(trigger: MarketTrigger): void {
    if (this.isTransitioning) {
      this.triggerQueue.push(trigger);
      return;
    }
    void this.executeTransition(trigger);
  }

  getState(): Readonly<GlobalState> {
    return this.state;
  }

  startJam(endsAt: number): void {
    const result = validateJamTransition(this.state.jam.status, 'running');
    if (!result.ok) {
      console.warn(`[broadcast] JAM_START rejected: ${result.error}`);
      return;
    }
    this.state.jam = { status: 'running', startedAt: Date.now(), endsAt, timeRemaining: endsAt - Date.now() };
    this.logEvent('jam_state_change', { from: 'idle', to: 'running' });
    this.emitState();
    this.dispatch({ type: 'market', appId: 'countdown-to-jam', source: 'system' });
  }

  endJam(): void {
    const result = validateJamTransition(this.state.jam.status, 'ended');
    if (!result.ok) {
      console.warn(`[broadcast] JAM_END rejected: ${result.error}`);
      return;
    }
    const prev = this.state.jam.status;
    this.state.jam = { ...this.state.jam, status: 'ended', timeRemaining: null };
    this.logEvent('jam_state_change', { from: prev, to: 'ended' });
    this.emitState();
    this.dispatch({ type: 'market', appId: 'end-of-countdown', source: 'system' });
  }

  panic(reason: 'app_error' | 'manual', appId?: string): void {
    this.state.broadcast.panicState = true;
    this.logEvent('panic_activated', { reason, appId });
    this.emitState();
    this.io.emit('broadcast:panic');
  }

  clearPanic(resumeAppId: AppId): void {
    this.state.broadcast.panicState = false;
    this.logEvent('panic_cleared', { resumedApp: resumeAppId });
    this.dispatch({ type: 'market', appId: resumeAppId, source: 'admin' });
  }

  destroy(): void {
    if (this.tickInterval)    clearInterval(this.tickInterval);
    if (this.persistInterval) clearInterval(this.persistInterval);
    this.persist();
  }

  // ─── Transition engine ──────────────────────────────────────────────────────

  private async executeTransition(trigger: MarketTrigger): Promise<void> {
    if (this.state.broadcast.activeApp === trigger.appId) {
      // Idempotent — already on this app
      return;
    }

    this.isTransitioning = true;
    const fromApp = this.state.broadcast.activeApp;
    const startedAt = Date.now();

    this.state.broadcast.transition = 'in_progress';
    this.state.broadcast.activeApp  = trigger.appId;
    this.emitState();

    // Wait for client ack or failsafe timeout
    await this.waitForTransitionAck();

    this.state.broadcast.transition = 'idle';
    this.isTransitioning = false;

    this.logEvent('transition', {
      fromApp,
      toApp:       trigger.appId,
      trigger,
      duration_ms: Date.now() - startedAt,
    });

    this.emitState();

    // Process queued trigger
    const next = this.triggerQueue.shift();
    if (next) void this.executeTransition(next);
  }

  private waitForTransitionAck(): Promise<void> {
    return new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        this.pendingTransitionResolve = null;
        this.logEvent('lifecycle_timeout', { method: 'transition', timeout_ms: TRANSITION_ACK_MS });
        resolve();
      }, TRANSITION_ACK_MS);

      this.pendingTransitionResolve = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  }

  // ─── Scheduler tick ─────────────────────────────────────────────────────────

  private tick(): void {
    const jam = this.state.jam;

    // Update timeRemaining
    if (jam.status === 'running' && jam.endsAt !== null) {
      this.state.jam.timeRemaining = Math.max(0, jam.endsAt - Date.now());
    }

    // Evaluate limit triggers
    for (const trigger of this.schedule) {
      if (trigger.fired) continue;
      if (!shouldFire(trigger.condition, jam)) continue;

      trigger.fired = true;
      this.logEvent('trigger_fired', { trigger });
      this.dispatch({ type: 'market', appId: trigger.appId, source: 'system' });
    }

    // Emit timeRemaining only (lightweight tick)
    this.io.emit('tick', { timeRemaining: this.state.jam.timeRemaining });
  }

  // ─── Pool listeners ─────────────────────────────────────────────────────────

  private setupPoolListeners(): void {
    this.pool.on('update', () => {
      this.state.pool = this.pool.getStats();
      this.emitState();
    });

    this.pool.on('item:ready', (itemId: string) => {
      this.io.emit('pool:item:ready', { itemId });
    });
  }

  // ─── Socket.io handlers ─────────────────────────────────────────────────────

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // Send full state on connect
      socket.emit('state', this.state);

      // Transition ack from broadcast client
      socket.on('broadcast:transition:complete', () => {
        if (this.pendingTransitionResolve) {
          this.pendingTransitionResolve();
          this.pendingTransitionResolve = null;
        }
      });
    });
  }

  // ─── State emission ─────────────────────────────────────────────────────────

  private emitState(): void {
    this.state.pool = this.pool.getStats();
    this.io.emit('state', this.state);
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private loadOrInitState(): GlobalState {
    try {
      if (existsSync(STATE_FILE)) {
        const raw = readFileSync(STATE_FILE, 'utf-8');
        const persisted = JSON.parse(raw) as PersistedState;

        // Recalculate timeRemaining after restart
        if (persisted.jam.status === 'running' && persisted.jam.endsAt !== null) {
          persisted.jam.timeRemaining = Math.max(0, persisted.jam.endsAt - Date.now());
        }

        // Restore fired flags from persisted schedule
        for (const trigger of this.schedule) {
          const saved = persisted.schedule.find(s => s.appId === trigger.appId && s.condition.at === trigger.condition.at);
          if (saved?.fired) trigger.fired = true;
        }

        return {
          jam:       persisted.jam,
          broadcast: { activeApp: persisted.activeApp, transition: 'idle', panicState: false },
          pool:      { total: 0, fresh: 0, queueSnapshot: [] },
        };
      }
    } catch (err) {
      console.warn('[broadcast] Failed to load state.json, starting fresh:', err);
    }

    return {
      jam:       { status: 'idle', startedAt: null, endsAt: null, timeRemaining: null },
      broadcast: { activeApp: 'pre-jam-idle', transition: 'idle', panicState: false },
      pool:      { total: 0, fresh: 0, queueSnapshot: [] },
    };
  }

  private persist(): void {
    const data: PersistedState = {
      jam:       this.state.jam,
      activeApp: this.state.broadcast.activeApp,
      schedule:  this.schedule,
    };
    const json = JSON.stringify(data, null, 2);
    const tmp  = `${STATE_FILE}.tmp`;
    // Atomic write: write to .tmp then rename — prevents empty/corrupt state.json on crash
    writeFile(tmp, json).then(() => rename(tmp, STATE_FILE)).catch(() => {
      try { writeFileSync(tmp, json); renameSync(tmp, STATE_FILE); } catch { /* best effort */ }
    });
  }

  // ─── Schedule loading ────────────────────────────────────────────────────────

  private loadSchedule(filePath: string): LimitTrigger[] {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const entries = JSON.parse(raw) as ScheduleEntry[];

      return entries.flatMap(entry => {
        const appId = entry.app ?? entry.trigger;
        if (!appId) return [];
        try {
          return [{ type: 'limit' as const, condition: parseScheduleEntry(entry.at), appId, fired: false }];
        } catch (err) {
          console.warn(`[broadcast] Skipping schedule entry "${entry.at}": ${err}`);
          return [];
        }
      });
    } catch (err) {
      console.warn('[broadcast] Failed to load schedule.json:', err);
      return [];
    }
  }

  // ─── Logging ─────────────────────────────────────────────────────────────────

  private logEvent(type: Parameters<typeof insertBroadcastEvent>[0]['type'], payload: Record<string, unknown>): void {
    try {
      insertBroadcastEvent({ id: randomUUID(), type, payload, createdAt: Date.now() });
    } catch (err) {
      console.error('[broadcast] Failed to log event:', err);
    }
  }

  private startTick(): void {
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  private startPersist(): void {
    this.persistInterval = setInterval(() => this.persist(), PERSIST_MS);
  }
}
