const MIN  = 60_000;
const HOUR = 60 * MIN;

function freshnessScore(age: number): number {
  if (age < 2  * MIN)  return  80;
  if (age < 15 * MIN)  return  30;
  if (age < 1  * HOUR) return   0;
  return -50;
}

export function computeScore(
  item:   { priority: number; submittedAt: number },
  counts: { displayed: number; skipped: number },
  now:    number = Date.now(),
): number {
  return item.priority
    + freshnessScore(now - item.submittedAt)
    - counts.displayed * 40
    - counts.skipped   * 120;
}
