import type { SwarmTroopersElement, CursorShape, Point, Rect } from './types.js';
import type { Agent, Task } from './model.js';
import type { Annotation, AnnotationInit } from './overlay.js';
import type { TextGeo } from './text.js';
import { type MoveOpts } from './motion.js';
import type { Rng } from './util.js';
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
    move(to: Point | (() => Point), options?: MoveOpts & {
        onStep?: () => void;
    }): ToolGen;
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
        /** Shows the top-left part of the element, `x` and `y` from 0 to 1, with a soft edge where the mask allows it. */
        sweep(x: number, y: number): void;
        /** Removes the clip-path and the soft edge. */
        end(): void;
        /** Shows the element at once with a short fade, and marks the task as done. */
        pop(): void;
        /** Like pop, but the element drops into place with a small bounce, as if just set down. */
        settle(): void;
    };
}
export type Tool = (c: ToolContext) => ToolGen;
export declare const TOOLS: Map<string, Tool>;
