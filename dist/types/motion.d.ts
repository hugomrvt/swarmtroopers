import type { Point } from './types.js';
import { type Rng } from './util.js';
/** Fitts's law, Shannon formulation. Movement time in seconds. */
export declare function fitts(distance: number, width: number, a?: number, b?: number): number;
/** Minimum-jerk position profile (Flash and Hogan, 1985), from 0 to 1. */
export declare function minJerk(t: number): number;
/** Small individual differences between agents. */
export interface Persona {
    /** Side the hand tends to bend towards. */
    side: number;
    /** Path curvature relative to the distance. */
    curve: number;
    /** Share of the distance covered by the first, ballistic submovement. */
    reach: number;
    /** Personal speed factor. */
    pace: number;
}
export declare function persona(r: Rng): Persona;
export interface Segment {
    from: Point;
    ctrl: Point;
    to: Point;
    dur: number;
    pause: number;
}
export interface MoveOpts {
    /** Size of the target along the movement, in pixels. Small targets take longer to reach. */
    width?: number;
    /** Mouse button held: slower and straighter. */
    drag?: boolean;
}
/**
 * Plans an aimed pointer movement. Long movements are split into a fast primary
 * submovement that lands a little short of the target, then a slower corrective
 * one (optimized submovement model, Meyer et al., 1988).
 */
export declare function planMove(from: Point, to: Point, p: Persona, r: Rng, o?: MoveOpts): Segment[];
/** Position on a segment after `t` seconds: quadratic Bézier path, minimum-jerk timing. */
export declare function pointOn(s: Segment, t: number): Point;
/** Time budget to type a block. It grows with the length, slowly, so long paragraphs stay short. */
export declare function typingBudget(chars: number, pace?: number): number;
/**
 * Cumulative timestamps, one per character, adding up to `duration`. Typing comes in bursts: each word has
 * its own speed, its first letter waits a little, and punctuation and spaces take longer.
 */
export declare function typingSchedule(text: string, duration: number, r: Rng): Float32Array;
