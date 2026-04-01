// EnrichmentPoller — polls at a fixed interval until companion content appears.
//
// onTick is called on each interval. It should return true if enrichment
// happened (poller stops), or false to keep polling.

export class EnrichmentPoller {
  private readonly intervalMs: number;
  private readonly onTick: () => boolean;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(intervalMs: number, onTick: () => boolean) {
    this.intervalMs = intervalMs;
    this.onTick     = onTick;
  }

  schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const enriched = this.onTick();
      if (!enriched) this.schedule();
    }, this.intervalMs);
  }

  cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
