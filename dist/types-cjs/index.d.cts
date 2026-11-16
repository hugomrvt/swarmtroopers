import { SwarmTroopers } from './swarmtroopers.cjs';
import { type Tool } from './tools.cjs';
import type { SwarmTroopersOptions } from './types.cjs';
export { SwarmTroopers } from './swarmtroopers.cjs';
export { controls, type ControlsOptions } from './controls.cjs';
export { tokens, type TokensOptions } from './plugins/tokens.cjs';
export type { ChatOptions, ChatLines, ChatKey } from './chat.cjs';
export type { SwarmTroopersElement, SwarmTroopersEventMap, SwarmTroopersOptions, SwarmTroopersPlugin, SwarmTroopersStats, CursorShape, PaletteSpec, Point, Quality, QualitySetting, Rect, Trigger, } from './types.cjs';
export type { Tool, ToolContext, ToolGen } from './tools.cjs';
export type { Agent, Task } from './model.cjs';
export type { AnnotationInit, AnnotationKind } from './overlay.cjs';
export declare const version: string;
/** Creates an instance on the page. Call it in the browser, once the content is in the DOM. */
export declare function create(options?: SwarmTroopersOptions): SwarmTroopers;
/** Registers a custom tool, usable as data-swarmtroopers="name". */
export declare function defineTool(name: string, tool: Tool): void;
