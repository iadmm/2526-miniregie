import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { shouldFire, parseScheduleEntry } from './triggers.js';
import { validateJamTransition } from './jam-state.js';
import { insertBroadcastEvent, resetAllMedia, getScheduleEntries, markScheduleEntryFired, resetScheduleStatus } from '../db/queries.js';
import type { GlobalState, LimitTrigger, MarketTrigger, AppId, JamStatus } from '../../../shared/types.js';
import type { PoolManager } from '../pool/index.js';
import { getJamConfig } from '../jam-config.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** LimitTrigger extended with the DB row id for persistent fired tracking. */
type DbLimitTrigger = LimitTrigger & { dbId: number };

interface PersistedState {
  jam:          GlobalState['jam'];
  activeApp:    AppId;
  panicState:   boolean;
  panicMessage: string;
}

const STATE_FILE = 'state.json';
const TICK_MS    = 1_000;

// ─── BroadcastManager ─────────────────────────────────────────────────────────

export class BroadcastManager {
  private state:    GlobalState;
  private schedule: DbLimitTrigger[];

  private readonly io:   Server;
  private readonly pool: PoolManager;

  private tickInterval:    ReturnType<typeof setInterval> | null = null;
  private persistInterval: ReturnType<typeof setInterval> | null = null;

  // Pool hold counter — incremented each time jam-mode enters hold regime
  private holdCount = 0;

  // Transition coordination
  private isTransitioning              = false;
  private triggerQueue:                MarketTrigger[] = [];
  private pendingTransitionResolve:    (() => void) | null = null;

  private readonly cfg: ReturnType<typeof getJamConfig>['broadcast'];

  constructor(options: { io: Server; pool: PoolManager }) {
    this.io   = options.io;
    this.pool = options.pool;
    this.cfg  = getJamConfig().broadcast;

    this.schedule   = this.loadSchedule();
    this.state      = this.loadOrInitState();
    this.state.pool = this.pool.getStats(); // populate from DB on startup

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

  getSchedule(): ReadonlyArray<LimitTrigger> {
    return this.schedule;
  }

  /**
   * Reloads the schedule from DB without modifying any data.
   * Call this after any admin CRUD operation on schedule entries.
   */
  reloadSchedule(): void {
    this.schedule = this.loadSchedule();
  }

  // Compute the absolute timestamp of the next unfired schedule trigger.
  private computeNextTriggerAt(): number | null {
    const jam = this.state.jam;
    let earliest: number | null = null;

    for (const trigger of this.schedule) {
      if (trigger.fired) continue;

      let absTime: number | null = null;
      const c = trigger.condition;

      if (c.at === 'absolute') {
        absTime = new Date(c.value).getTime();
      } else if (c.at === 'H+' && jam.startedAt !== null) {
        absTime = jam.startedAt + c.value;
      } else if (c.at === 'T-' && jam.endsAt !== null) {
        absTime = jam.endsAt - c.value;
      }

      if (absTime !== null && (earliest === null || absTime < earliest)) {
        earliest = absTime;
      }
    }

    return earliest;
  }

  startJam(endsAt = new Date(getJamConfig().jam.endsAt).getTime()): void {
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
    setTimeout(() => {
      this.dispatch({ type: 'market', appId: 'post-jam-idle', source: 'system' });
    }, this.cfg.postJamIdleDelayMs);
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

  setPanicMessage(message: string): void {
    this.state.broadcast.panicMessage = message;
    this.emitState();
  }

  /**
   * Called by the broadcast client's jam-mode app whenever its active items or
   * regime change.  Updates the shared GlobalState so the admin UI can observe
   * what is currently on-air.
   */
  updateJamMode(activeItemIds: string[], regime: 'normal' | 'hold' | 'buffer'): void {
    // Increment hold counter on each transition INTO hold
    if (regime === 'hold' && this.state.broadcast.regime !== 'hold') {
      this.holdCount++;
    }
    this.state.broadcast.activeItemIds = activeItemIds;
    this.state.broadcast.regime        = regime;
    this.emitState();
  }

  reset(): void {
    // Clear all media from DB
    resetAllMedia();

    // Reset in-memory pool state
    this.pool.reset();

    // Reset JAM state machine
    this.holdCount       = 0;
    this.state.jam       = { status: 'idle', startedAt: null, endsAt: null, timeRemaining: null };
    this.state.broadcast = { activeApp: 'pre-jam-idle', transition: 'idle', panicState: false, panicMessage: '', nextTriggerAt: null, activeItemIds: [], regime: 'normal' };

    // Reset all schedule entries in DB and reload so triggers can fire again
    resetScheduleStatus();
    this.schedule = this.loadSchedule();

    // Clear any pending transition
    this.isTransitioning = false;
    this.triggerQueue    = [];
    if (this.pendingTransitionResolve) {
      this.pendingTransitionResolve();
      this.pendingTransitionResolve = null;
    }

    this.logEvent('jam_state_change', { from: 'reset', to: 'idle' });
    this.persist();
    this.emitState();
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
        this.logEvent('lifecycle_timeout', { method: 'transition', timeout_ms: this.cfg.transitionFailsafeMs });
        resolve();
      }, this.cfg.transitionFailsafeMs);

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
    const now = Date.now();
    for (const trigger of this.schedule) {
      if (trigger.fired) continue;
      if (!shouldFire(trigger.condition, jam, now)) continue;

      trigger.fired = true;
      markScheduleEntryFired(trigger.dbId, now);
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
    this.state.pool = this.pool.getStats(this.holdCount);
    this.state.broadcast.nextTriggerAt = this.computeNextTriggerAt();
    this.io.emit('state', this.state);
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private loadOrInitState(): GlobalState {
    try {
      if (existsSync(STATE_FILE)) {
        // NOTE: we no longer use the persisted schedule — fired state lives in DB.
        // The in-memory schedule was already populated by loadSchedule() reading DB.
        const raw       = readFileSync(STATE_FILE, 'utf-8');
        const persisted = JSON.parse(raw) as PersistedState;

        // Recalculate timeRemaining after restart
        if (persisted.jam.status === 'running' && persisted.jam.endsAt !== null) {
          persisted.jam.timeRemaining = Math.max(0, persisted.jam.endsAt - Date.now());
        }

        return {
          jam:       persisted.jam,
          broadcast: { activeApp: persisted.activeApp, transition: 'idle', panicState: persisted.panicState ?? false, panicMessage: persisted.panicMessage ?? '', nextTriggerAt: null, activeItemIds: [], regime: 'normal' },
          pool:      { total: 0, queueSnapshot: [], byType: {}, holdCount: 0 },
        };
      }
    } catch (err) {
      console.warn('[broadcast] Failed to load state.json, starting fresh:', err);
    }

    return {
      jam:       { status: 'idle', startedAt: null, endsAt: null, timeRemaining: null },
      broadcast: { activeApp: 'pre-jam-idle', transition: 'idle', panicState: false, panicMessage: '', nextTriggerAt: null, activeItemIds: [], regime: 'normal' },
      pool:      { total: 0, queueSnapshot: [], byType: {}, holdCount: 0 },
    };
  }

  private persist(): void {
    // Schedule fired state is authoritative in DB — not persisted in state.json.
    const data: PersistedState = {
      jam:          this.state.jam,
      activeApp:    this.state.broadcast.activeApp,
      panicState:   this.state.broadcast.panicState,
      panicMessage: this.state.broadcast.panicMessage,
    };
    const json = JSON.stringify(data, null, 2);
    const tmp  = `${STATE_FILE}.tmp`;
    // Atomic write: write to .tmp then rename — prevents empty/corrupt state.json on crash
    writeFile(tmp, json).then(() => rename(tmp, STATE_FILE)).catch(() => {
      try { writeFileSync(tmp, json); renameSync(tmp, STATE_FILE); } catch { /* best effort */ }
    });
  }

  // ─── Schedule loading ────────────────────────────────────────────────────────

  private loadSchedule(): DbLimitTrigger[] {
    const entries = getScheduleEntries();
    return entries.flatMap(entry => {
      // Skip already-fired entries — they must not re-trigger after a restart
      if (entry.status === 'fired') return [];
      try {
        return [{
          type:      'limit' as const,
          condition: parseScheduleEntry(entry.at),
          appId:     entry.app,
          fired:     false,
          dbId:      entry.id,
        }];
      } catch (err) {
        console.warn(`[broadcast] Skipping schedule entry id=${entry.id} "${entry.at}": ${err}`);
        return [];
      }
    });
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
    this.persistInterval = setInterval(() => this.persist(), this.cfg.statePersistIntervalMs);
  }
}
