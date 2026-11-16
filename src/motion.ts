import type { Point } from './types.js';
import { clamp, type Rng } from './util.js';

/** Fitts's law, Shannon formulation. Movement time in seconds. */
export function fitts(distance: number, width: number, a = 0.07, b = 0.12): number {
  return a + b * Math.log2(Math.max(0, distance) / Math.max(4, width) + 1);
}

/** Minimum-jerk position profile (Flash and Hogan, 1985), from 0 to 1. */
export function minJerk(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * u * (10 + u * (6 * u - 15));
}

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

export function persona(r: Rng): Persona {
  return {
    side: r.chance(0.7) ? 1 : -1,
    curve: r.range(0.05, 0.15),
    reach: r.range(0.9, 0.97),
    pace: r.range(0.85, 1.25),
  };
}

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

function segment(from: Point, to: Point, dur: number, bend: number, pause = 0): Segment {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = bend * Math.min(len, 700);
  return {
    from,
    to,
    dur,
    pause,
    ctrl: { x: (from.x + to.x) / 2 - (dy / len) * off, y: (from.y + to.y) / 2 + (dx / len) * off },
  };
}

/**
 * Plans an aimed pointer movement. Long movements are split into a fast primary
 * submovement that lands a little short of the target, then a slower corrective
 * one (optimized submovement model, Meyer et al., 1988).
 */
export function planMove(from: Point, to: Point, p: Persona, r: Rng, o: MoveOpts = {}): Segment[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return [];
  const width = o.width ?? 18;
  const bend = p.curve * p.side * (o.drag ? 0.2 : 1);
  const total = (fitts(d, width) * (o.drag ? 1.4 : 1)) / p.pace;
  if (o.drag || d < 140) return [segment(from, to, Math.max(0.1, total), bend)];
  const ux = dx / d;
  const uy = dy / d;
  const lateral = clamp(r.normal(0, 0.02 * d), -0.05 * d, 0.05 * d);
  const mid = { x: from.x + dx * p.reach - uy * lateral, y: from.y + dy * p.reach + ux * lateral };
  const rest = Math.hypot(to.x - mid.x, to.y - mid.y);
  return [
    segment(from, mid, Math.max(0.1, total * 0.78), bend),
    segment(mid, to, Math.max(0.06, (fitts(rest, width) * 0.8) / p.pace), bend * 0.3, r.range(0.02, 0.06)),
  ];
}

/** Position on a segment after `t` seconds: quadratic Bézier path, minimum-jerk timing. */
export function pointOn(s: Segment, t: number): Point {
  const k = minJerk(s.dur > 0 ? t / s.dur : 1);
  const m = 1 - k;
  return {
    x: m * m * s.from.x + 2 * m * k * s.ctrl.x + k * k * s.to.x,
    y: m * m * s.from.y + 2 * m * k * s.ctrl.y + k * k * s.to.y,
  };
}

/** Time budget to type a block. It grows with the length, slowly, so long paragraphs stay short. */
export function typingBudget(chars: number, pace = 1): number {
  return (0.35 + 0.42 * Math.log2(1 + Math.max(0, chars) / 12)) / pace;
}

/** Cumulative timestamps, one per character, adding up to `duration`. Punctuation and spaces take longer. */
export function typingSchedule(text: string, duration: number, r: Rng): Float32Array {
  const n = text.length;
  const weights = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const c = text[i];
    let w = c === ' ' ? 2.2 : c === '\n' ? 6 : ',;:'.indexOf(c) >= 0 ? 4 : '.!?'.indexOf(c) >= 0 ? 6 : 1;
    if (r.chance(0.03)) w += 5;
    w *= r.range(0.7, 1.3);
    weights[i] = w;
    sum += w;
  }
  const out = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += (weights[i] / (sum || 1)) * duration;
    out[i] = acc;
  }
  return out;
}
