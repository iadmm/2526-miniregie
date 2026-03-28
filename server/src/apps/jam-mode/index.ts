// jam-mode app — server-side entry point

import type { App, AppId, MediaItem } from "@shared/types";
import type { PoolManager } from "../../pool";

// ─── JamModeQueues ────────────────────────────────────────────────────────────

export interface JamModeQueues {
  loud:   MediaItem[]; // youtube + clip → loud slot
  visual: MediaItem[]; // photo + gif    → silent visual slot
  note:   MediaItem[]; // note           → silent caption slot
  ticker: MediaItem[]; // ticker         → PersistentChrome belt (cycled independently)
}

// ─── JamModeApp ───────────────────────────────────────────────────────────────
//
// Server-side lifecycle shell for the jam-mode broadcast app.
// The server drives all state (regime, active items, layout prediction) —
// the broadcast client only receives, never reports back.

export class JamModeApp implements App {
  readonly id: AppId = 'jam-mode';
  readonly outroMode = 'sequential' as const;

  private readonly pool: PoolManager;

  queues: JamModeQueues = { loud: [], visual: [], note: [], ticker: [] };

  constructor(pool: PoolManager) {
    this.pool = pool;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  load(_signal: AbortSignal): void {
    this.queues = this.fetchQueues();
  }

  play(): void {
    // future: start item fetch loop, begin sequencing
  }

  async stop(): Promise<void> {
    // future: drain in-progress items, resolve pending transitions
  }

  remove(): void {
    this.queues = { loud: [], visual: [], note: [], ticker: [] };
  }

  // ─── Pool delegation ────────────────────────────────────────────────────────

  onPoolUpdate(_item: MediaItem): void {
    this.queues = this.fetchQueues();
  }

  // ─── Queue snapshot ─────────────────────────────────────────────────────────

  private fetchQueues(): JamModeQueues {
    return {
      loud:   this.pool.getMain({ types: ['youtube', 'clip'] }),
      visual: this.pool.getMain({ types: ['photo', 'gif'] }),
      note:   this.pool.getMain({ types: ['note'] }),
      ticker: this.pool.getMain({ types: ['ticker'] }),
    };
  }
}