// ClockEngine — manages #clock-layer.
// Driven by server 'tick' events (timeRemaining ms) + direct update().
//
// Display states:
//   T > 2h     → clock--compact (top-right, small)
//   T ≤ 2h     → clock--large   (top-right, growing)
//   T ≤ 1h     → clock--dominant (~30% screen, Commit Mono)
//   T ≤ 10min  → clock--fullscreen (red #dc2626, layer z-index above scene-layer)

import type { Socket } from 'socket.io-client';

type ClockMode = 'compact' | 'large' | 'dominant' | 'fullscreen';

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const hh = Math.floor(total / 3_600);
  const mm = Math.floor((total % 3_600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function getMode(timeRemaining: number | null): ClockMode {
  if (timeRemaining === null) return 'compact';
  if (timeRemaining <=  10 * 60_000) return 'fullscreen';
  if (timeRemaining <=  60 * 60_000) return 'dominant';
  if (timeRemaining <= 120 * 60_000) return 'large';
  return 'compact';
}

export class ClockEngine {
  private readonly layer: HTMLElement;
  private readonly el: HTMLElement;
  private currentMode: ClockMode = 'compact';
  private tickHandler: ((p: { timeRemaining: number | null }) => void) | null = null;

  constructor(layer: HTMLElement) {
    this.layer = layer;
    this.el = document.createElement('div');
    this.el.className = 'clock clock--compact';
    layer.appendChild(this.el);
  }

  mount(socket: Socket, initialTimeRemaining: number | null): void {
    this.update(initialTimeRemaining);
    this.tickHandler = (p) => this.update(p.timeRemaining);
    socket.on('tick', this.tickHandler);
  }

  update(timeRemaining: number | null): void {
    if (timeRemaining !== null) {
      this.el.textContent = formatMs(timeRemaining);
    }
    const mode = getMode(timeRemaining);
    if (mode !== this.currentMode) {
      this.el.classList.remove(`clock--${this.currentMode}`);
      this.el.classList.add(`clock--${mode}`);
      // At T-10min clock-layer rises above scene-layer (CSS class on layer)
      this.layer.classList.toggle('clock-layer--urgent', mode === 'fullscreen');
      this.currentMode = mode;
    }
  }

  destroy(socket: Socket): void {
    if (this.tickHandler) {
      socket.off('tick', this.tickHandler);
      this.tickHandler = null;
    }
    this.layer.innerHTML = '';
    this.layer.classList.remove('clock-layer--urgent');
  }
}
