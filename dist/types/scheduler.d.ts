import type { Point } from './types.js';
export interface Candidate {
    order: number;
    inView: boolean;
}
/** Visible work first, then reading order. */
export declare function byPriority(a: Candidate, b: Candidate): number;
/**
 * Among the first `k` candidates in priority order, takes the one closest to the agent.
 * Later candidates are penalised so the page still reads top to bottom.
 */
export declare function pickTask<T>(sorted: readonly T[], from: Point, k: number, anchor: (t: T) => Point): T | null;
