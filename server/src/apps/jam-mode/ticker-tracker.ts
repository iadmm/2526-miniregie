// TickerTracker — counts scroll passes for ticker items.
//
// The broadcast client emits 'ticker:pass' with the IDs of all currently
// visible ticker items each time the scroll animation completes one full loop.
// After MAX_PASSES complete loops, each item is marked as displayed and removed
// from the pool.

export class TickerTracker {
  private readonly maxPasses: number;
  private passes = new Map<string, number>();

  constructor(maxPasses = 5) {
    this.maxPasses = maxPasses;
  }

  recordPass(itemIds: string[], markDisplayed: (id: string) => void): void {
    for (const id of itemIds) {
      const count = (this.passes.get(id) ?? 0) + 1;
      if (count >= this.maxPasses) {
        this.passes.delete(id);
        markDisplayed(id);
      } else {
        this.passes.set(id, count);
      }
    }
  }

  clear(): void {
    this.passes.clear();
  }
}
