import type { Point } from './types.js';

export interface Candidate {
  order: number;
  inView: boolean;
}

/** Visible work first, then reading order. */
export function byPriority(a: Candidate, b: Candidate): number {
  if (a.inView !== b.inView) return a.inView ? -1 : 1;
  return a.order - b.order;
}

/**
 * Among the first `k` candidates in priority order, takes the one closest to the agent.
 * Later candidates are penalised so the page still reads top to bottom.
 */
export function pickTask<T>(sorted: readonly T[], from: Point, k: number, anchor: (t: T) => Point): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  const n = Math.min(k, sorted.length);
  for (let i = 0; i < n; i++) {
    const p = anchor(sorted[i]);
    const score = Math.hypot(p.x - from.x, p.y - from.y) * (1 + i * 0.35);
    if (score < bestScore) {
      bestScore = score;
      best = sorted[i];
    }
  }
  return best;
}
