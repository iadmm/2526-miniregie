export const APP_COLORS: Record<string, string> = {
  'pre-jam-idle':     '#555555',
  'countdown-to-jam': '#f59e0b',
  'jam-mode':         '#e87c2a',
  'micro-trottoir':   '#22c55e',
  'end-of-countdown': '#3b82f6',
  'post-jam-idle':    '#8b5cf6',
};

export const APPS = [
  'pre-jam-idle',
  'countdown-to-jam',
  'jam-mode',
  'micro-trottoir',
  'end-of-countdown',
  'post-jam-idle',
] as const;

export type KnownAppId = typeof APPS[number];
