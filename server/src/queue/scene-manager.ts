import { EventEmitter } from 'node:events';
import type { PoolManager } from '../pool/index.js';
import type { ActiveScene, JamStatus } from '../../../shared/types.js';

export class SceneManager extends EventEmitter {
  constructor(
    _pool: PoolManager,
    _opts: { getJamStatus: () => JamStatus },
  ) {
    super();
  }

  getScene(): ActiveScene | null {
    return null;
  }

  onJamStart(): void {}

  onLoudEnded(_itemId: string): void {}

  forceReset(): void {}

  destroy(): void {}
}