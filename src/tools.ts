import type { SwarmTroopersElement, CursorShape, Point, Rect } from './types.js';
import type { Agent, Task } from './model.js';
import type { Annotation, AnnotationInit } from './overlay.js';
import type { TextGeo } from './text.js';
import { clipAt } from './text.js';
import { typingBudget, typingSchedule, type MoveOpts } from './motion.js';
import { clamp, type Rng } from './util.js';

/** A tool is a coroutine: each `yield` waits for the next frame and receives the elapsed time. */
export type ToolGen = Generator<void, void, number>;

export interface ToolContext {
  readonly el: SwarmTroopersElement;
  readonly task: Task;
  readonly agent: Agent;
  readonly random: Rng;
  /** Live document rectangle of the element (follows transforms and scrolling containers). */
  rect(): Rect;
  /** For a stamp, the rectangle of the item it is copied from. */
  sourceRect(): Rect | null;
  /** Moves the pointer like a hand would. Targets given as functions are followed if they move. */
  move(to: Point | (() => Point), options?: MoveOpts & { onStep?: () => void }): ToolGen;
  wait(seconds: number): ToolGen;
  click(): ToolGen;
  shape(shape: CursorShape): void;
  hold(on: boolean): void;
  dim(on: boolean): void;
  mark(init: AnnotationInit): Annotation;
  /** Label for the element: design tokens when a plugin knows them, its size otherwise. */
  label(): string;
  text(): TextGeo | null;
  reveal: {
    /** Makes the element visible, optionally behind a first clip-path. */
    begin(clip?: string): void;
    clip(value: string): void;
    /** Removes the clip-path. */
    end(): void;
    /** Shows the element at once with a short fade, and marks the task as done. */
    pop(): void;
  };
}

export type Tool = (c: ToolContext) => ToolGen;

/** Right or bottom inset, in %, for a progress from 0 to 1. */
const inset = (progress: number): string => (100 - clamp(progress, 0, 1) * 100).toFixed(2) + '%';

/** Drags a selection from the top-left corner to the bottom-right one. The element shows inside it. */
function* frame(c: ToolContext): ToolGen {
  c.shape('cross');
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x, y: r.y };
  }, { width: 14 });
  yield* c.click();
  c.hold(true);
  c.reveal.begin('inset(0 100% 100% 0)');
  const band = c.mark({
    kind: 'drag',
    rect: () => {
      const r = c.rect();
      return { x: r.x, y: r.y, w: c.agent.x - r.x, h: c.agent.y - r.y };
    },
  });
  const start = c.rect();
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x + r.w, y: r.y + r.h };
  }, {
    drag: true,
    width: Math.max(24, Math.min(start.w, start.h) / 2),
    onStep: () => {
      const r = c.rect();
      c.reveal.clip(`inset(0 ${inset(r.w ? (c.agent.x - r.x) / r.w : 1)} ${inset(r.h ? (c.agent.y - r.y) / r.h : 1)} 0)`);
    },
  });
  c.hold(false);
  c.reveal.end();
  band.done();
  const label = c.label();
  if (label) c.mark({ kind: 'select', rect: () => c.rect(), label, ttl: 0.8 });
  c.shape('arrow');
  yield* c.wait(0.18);
}

/** Draws a separator from one end to the other. */
function* rule(c: ToolContext): ToolGen {
  const r0 = c.rect();
  const horizontal = r0.w >= r0.h;
  const from = (): Point => {
    const r = c.rect();
    return horizontal ? { x: r.x, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: r.y };
  };
  const to = (): Point => {
    const r = c.rect();
    return horizontal ? { x: r.x + r.w, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: r.y + r.h };
  };
  c.shape('cross');
  yield* c.move(from, { width: 12 });
  yield* c.click();
  c.hold(true);
  c.reveal.begin(horizontal ? 'inset(0 100% 0 0)' : 'inset(0 0 100% 0)');
  const line = c.mark({ kind: 'line', a: from, b: () => ({ x: c.agent.x, y: c.agent.y }) });
  yield* c.move(to, {
    drag: true,
    width: 30,
    onStep: () => {
      const r = c.rect();
      c.reveal.clip(
        horizontal
          ? `inset(0 ${inset(r.w ? (c.agent.x - r.x) / r.w : 1)} 0 0)`
          : `inset(0 0 ${inset(r.h ? (c.agent.y - r.y) / r.h : 1)} 0)`,
      );
    },
  });
  c.hold(false);
  c.reveal.end();
  line.done();
  c.shape('arrow');
  yield* c.wait(0.1);
}

/** Clicks at the start of the text and types it. The real text is in place: only a clip-path advances. */
function* type(c: ToolContext): ToolGen {
  let geo = c.text();
  if (!geo || !geo.pieces.length) {
    c.reveal.pop();
    return;
  }
  const first = (): Point => {
    const g = c.text() ?? geo!;
    const p = g.pieces[0];
    const l = g.lines[p.line];
    const r = c.rect();
    return { x: r.x + p.x0, y: r.y + (l.top + l.bottom) / 2 };
  };
  const line0 = geo.lines[geo.pieces[0].line];
  c.shape('beam');
  yield* c.move(first, { width: Math.max(10, line0.bottom - line0.top) });
  yield* c.click();
  let state = clipAt(geo, 0);
  c.reveal.begin(state.path);
  c.dim(true);
  const caret = c.mark({
    kind: 'caret',
    a: () => {
      const r = c.rect();
      return { x: r.x + state.x, y: r.y + state.top };
    },
    b: () => {
      const r = c.rect();
      return { x: r.x + state.x, y: r.y + state.bottom };
    },
  });
  const total = geo.seq.length;
  const times = typingSchedule(geo.seq, typingBudget(total, c.agent.persona.pace), c.random);
  let typed = 0;
  let t = 0;
  while (typed < total) {
    t += yield;
    while (typed < total && times[typed] <= t) typed++;
    geo = c.text() ?? geo;
    state = clipAt(geo, typed);
    c.reveal.clip(state.path);
  }
  c.reveal.end();
  caret.done();
  c.dim(false);
  c.shape('arrow');
  const label = c.label();
  if (label) c.mark({ kind: 'select', rect: () => c.rect(), label, ttl: 0.6 });
  yield* c.wait(0.08);
}

/** Picks up the previous item of a list and drops a copy in the next slot. */
function* stamp(c: ToolContext): ToolGen {
  const s0 = c.sourceRect();
  if (!s0) {
    yield* frame(c);
    return;
  }
  const off = { x: Math.min(s0.w * 0.35, 56), y: Math.min(s0.h * 0.35, 22) };
  c.shape('arrow');
  yield* c.move(() => {
    const r = c.sourceRect() ?? s0;
    return { x: r.x + off.x, y: r.y + off.y };
  }, { width: 40 });
  yield* c.click();
  const picked = c.mark({ kind: 'select', rect: () => c.sourceRect() ?? s0 });
  c.shape('stamp');
  c.hold(true);
  const ghost = c.mark({
    kind: 'ghost',
    rect: () => {
      const r = c.rect();
      return { x: c.agent.x - off.x, y: c.agent.y - off.y, w: r.w, h: r.h };
    },
  });
  yield* c.move(() => {
    const r = c.rect();
    return { x: r.x + off.x, y: r.y + off.y };
  }, { drag: true, width: 40 });
  c.hold(false);
  ghost.done();
  picked.done();
  c.reveal.pop();
  const label = c.label();
  if (label) c.mark({ kind: 'select', rect: () => c.rect(), label, ttl: 0.7 });
  c.shape('arrow');
  yield* c.wait(0.16);
}

export const TOOLS = new Map<string, Tool>([
  ['frame', frame],
  ['rule', rule],
  ['type', type],
  ['stamp', stamp],
]);
