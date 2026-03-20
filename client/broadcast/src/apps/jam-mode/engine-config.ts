// Engine configuration constants — §10 of specs
// Edit here to tune timing for the 48h event.

export const ENGINE_CONFIG = {
  DURATIONS: {
    photo: { normal: 20_000, extended: 45_000 },
    gif:   { normal: 20_000, extended: 45_000 },
    clip:  { normal: 20_000, extended: 45_000 },
    note:  { normal: 12_000, extended: 30_000 },
  },
  // Companion independent timer (same media types)
  COMPANION_DURATIONS: {
    photo: 20_000,
    gif:   20_000,
    clip:  20_000,
    note:  12_000,
  },
  BUFFER_EVERY:       5,      // enter buffer regime every N visual scenes
  BUFFER_DURATION:    12_000, // ms — buffer pause duration
  GRACE_PERIOD:       800,    // ms — debounce before layout recomposition
  PREFETCH_LEAD:      2_000,  // ms before scene end to signal prefetch
  MIN_SCENE_DURATION: 4_000,  // ms — never switch layout faster than this
  ATTRIBUTION_HOLD:   6_000,  // ms — attribution band stays visible
  YT_WATCHDOG:        8_000,  // ms — skip youtube if not PLAYING after this
} as const;

export type MediaTypeDuration = keyof typeof ENGINE_CONFIG.DURATIONS;
