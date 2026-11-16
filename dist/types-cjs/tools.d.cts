import type { SwarmTroopersElement, CursorShape, Point, Rect } from './types.cjs';
import type { Agent, Task } from './model.cjs';
import type { Annotation, AnnotationInit } from './overlay.cjs';
import type { TextGeo } from './text.cjs';
import { type MoveOpts } from './motion.cjs';
import { type Rng } from './util.cjs';
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
        /** Removes the clip-path. */
        end(): void;
        /** Shows the element at once with a short fade, and marks the task as done. */
        pop(): void;
    };
}
export type Tool = (c: ToolContext) => ToolGen;
export declare const TOOLS: Map<string, Tool>;
