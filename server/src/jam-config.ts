import { readFileSync, writeFileSync } from 'node:fs';
import type { JamConfig } from "@shared/types";

export type { JamConfig };

let _config: JamConfig | null = null;

export function loadJamConfig(filePath = 'config/jam.json'): JamConfig {
  const raw = readFileSync(filePath, 'utf-8');
  _config = JSON.parse(raw) as JamConfig;
  return _config;
}

export function getJamConfig(): JamConfig {
  if (!_config) return loadJamConfig();
  return _config;
}

// Merge patch into config in-place and persist to disk.
// In-place mutation keeps existing object references valid (BroadcastManager, PoolManager).
export function updateJamConfig(patch: Partial<JamConfig>, filePath = 'config/jam.json'): JamConfig {
  const current = getJamConfig();
  if (patch.jam)       Object.assign(current.jam,       patch.jam);
  if (patch.broadcast) Object.assign(current.broadcast, patch.broadcast);
  if (patch.pool)      Object.assign(current.pool,      patch.pool);
  if (patch.client)    Object.assign(current.client,    patch.client);
  writeFileSync(filePath, JSON.stringify(current, null, 2));
  return current;
}
