import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { validateJamTransition } from './jam-state.js';
import { insertBroadcastEvent, resetAllMedia } from '../db/queries.js';
import type { GlobalState, MarketTrigger, AppId, App } from "@shared/types";
import type { PoolManager } from "../pool";
import { getJamConfig } from '../jam-config.js';
import { ScheduleService } from './schedule.js';
import { loadState, buildInitialState, saveState, type PersistedState } from './persistence.js';
import { AppManager } from '../apps/app-manager.js';
import { JamModeApp } from "../apps/jam-mode";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_FILE = 'state.json';
const TICK_MS    = 1_000;

// ─── App factory ─────────────────────────────────────────────────────────────

function createApp(appId: AppId, pool: PoolManager): App {
  switch (appId) {
    case 'jam-mode': return new JamModeApp(pool);
    default: return {
      id: appId,
      outroMode: 'none',
      load:         () => {},
      play:         () => {},
      stop:         async () => {},
      remove:       () => {},
      onPoolUpdate: () => {},
    };
  }
}

// ─── BroadcastManager ─────────────────────────────────────────────────────────

export class BroadcastManager {
  private readonly state:    GlobalState;
  private readonly schedule: ScheduleService;
  private readonly apps:     AppManager;

  private readonly io:   Server;
  private readonly pool: PoolManager;

  private tickInterval:    ReturnType<typeof setInterval> | null = null;
  private persistInterval: ReturnType<typeof setInterval> | null = null;

  // Transition coordination
  private isTransitioning = false;
  private triggerQueue:   MarketTrigger[] = [];

  // Hold tracking (for pool stats)
  private holdCount  = 0;
  private wasHolding = false;

  private readonly cfg: ReturnType<typeof getJamConfig>['broadcast'];

  constructor(options: { io: Server; pool: PoolManager }) {
    this.io       = options.io;
    this.pool     = options.pool;
    this.cfg      = getJamConfig().broadcast;
    this.schedule = new ScheduleService();
    this.apps     = new AppManager(options.io);
    this.state    = loadState(STATE_FILE) ?? buildInitialState();
    this.state.pool = this.pool.getStats(); // populate from DB on startup

    // Layout and next prediction are computed server-side once the fetch loop exists
    this.state.broadcast.activeLayout   = null;
    this.state.broadcast.nextPrediction = null;

    this.setupSocketHandlers();
    this.setupPoolListeners();
    this.startTick();
    this.startPersist();

    // Re-hydrate the active app after a server restart so it can emit its state.
    const restoredAppId = this.state.broadcast.activeApp;
    if (restoredAppId) {
      void this.apps.transition(createApp(restoredAppId, this.pool));
    }
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

  getActiveAppState(): unknown {
    return this.apps.getActiveAppState();
  }

  getSchedule(): ReturnType<ScheduleService['get']> {
    return this.schedule.get();
  }

  /**
   * Reloads the schedule from DB without modifying any data.
   * Call this after any admin CRUD operation on schedule entries.
   */
  reloadSchedule(): void {
    this.schedule.reload();
  }

  startJam(): void {
    const result = validateJamTransition(this.state.jam.status, 'running');
    if (!result.ok) throw new Error(result.error);

    const startedAt = Date.now();
    const endsAt    = this.schedule.resolveJamEnd(startedAt);

    this.state.jam = { status: 'running', startedAt, endsAt, timeRemaining: endsAt - startedAt };
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

  reset(): void {
    resetAllMedia();
    this.pool.reset();
    this.apps.reset();

    this.state.jam       = { status: 'idle', startedAt: null, endsAt: null, timeRemaining: null };
    this.state.broadcast = {
      activeApp: 'pre-jam-idle', transition: 'idle', panicState: false, panicMessage: '',
      nextTriggerAt: null, activeItemIds: [], regime: 'normal', activeLayout: null, nextPrediction: null,
    };

    this.schedule.resetAll();

    this.isTransitioning = false;
    this.triggerQueue    = [];
    this.logEvent('jam_state_change', { from: 'reset', to: 'idle' });
    void saveState(STATE_FILE, this.toPersistedState());
    this.emitState();
  }

  reloadBroadcastClients(): void {
    this.io.emit('broadcast:reload');
  }

  destroy(): void {
    if (this.tickInterval)    clearInterval(this.tickInterval);
    if (this.persistInterval) clearInterval(this.persistInterval);
    this.apps.destroy();
    void saveState(STATE_FILE, this.toPersistedState());
  }

  // ─── Transition engine ──────────────────────────────────────────────────────

  private async executeTransition(trigger: MarketTrigger): Promise<void> {
    if (this.state.broadcast.activeApp === trigger.appId) {
      // Idempotent — already on this app
      return;
    }

    this.isTransitioning = true;
    const fromApp   = this.state.broadcast.activeApp;
    const startedAt = Date.now();

    this.state.broadcast.transition = 'in_progress';
    this.state.broadcast.activeApp  = trigger.appId;
    this.emitState();

    await this.apps.transition(createApp(trigger.appId, this.pool));

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

  // ─── Scheduler tick ─────────────────────────────────────────────────────────

  private tick(): void {
    const jam = this.state.jam;

    // Update timeRemaining
    if (jam.status === 'running' && jam.endsAt !== null) {
      this.state.jam.timeRemaining = Math.max(0, jam.endsAt - Date.now());
    }

    // Evaluate limit triggers
    const toFire = this.schedule.evaluateTick(jam, Date.now());
    for (const trigger of toFire) {
      this.logEvent('trigger_fired', { trigger });
      this.dispatch(trigger);
    }

    // Emit timeRemaining only (lightweight tick)
    this.io.emit('tick', { timeRemaining: this.state.jam.timeRemaining });
  }

  // ─── Pool listeners ─────────────────────────────────────────────────────────

  private setupPoolListeners(): void {
    this.pool.on('update', () => {
      const isHolding = this.isJamModeHolding();
      if (isHolding && !this.wasHolding) this.holdCount++;
      this.wasHolding = isHolding;
      this.emitState();
    });

    this.pool.on('item:ready', (itemId: string) => {
      this.io.emit('pool:item:ready', { itemId });
      const item = this.pool.getMain().find(i => i.id === itemId);
      if (item) this.apps.onPoolUpdate(item);
    });
  }

  // ─── Socket.io handlers ─────────────────────────────────────────────────────

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      // Send full state on connect
      socket.emit('state', this.state);
    });
  }

  // ─── State emission ─────────────────────────────────────────────────────────

  private isJamModeHolding(): boolean {
    return this.state.broadcast.activeApp === 'jam-mode'
      && this.pool.getStats().total === 0;
  }

  private emitState(): void {
    const appState = this.apps.getActiveAppState() as { slots?: Partial<Record<string, { id: string } | undefined>> } | null;
    this.state.broadcast.activeItemIds = appState?.slots
      ? Object.values(appState.slots).filter((i): i is { id: string } => i != null).map(i => i.id)
      : [];
    this.state.broadcast.regime        = this.isJamModeHolding() ? 'hold' : 'normal';
    this.state.broadcast.nextTriggerAt = this.schedule.getNextTriggerAt(this.state.jam);
    this.state.pool = this.pool.getStats(this.holdCount);
    this.io.emit('state', this.state);
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  private toPersistedState(): PersistedState {
    return {
      jam:          this.state.jam,
      activeApp:    this.state.broadcast.activeApp,
      panicState:   this.state.broadcast.panicState,
      panicMessage: this.state.broadcast.panicMessage,
    };
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
    this.persistInterval = setInterval(
      () => void saveState(STATE_FILE, this.toPersistedState()),
      this.cfg.statePersistIntervalMs,
    );
  }
}