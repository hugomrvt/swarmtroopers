import { SwarmTroopers } from './swarmtroopers.js';
import { type Tool } from './tools.js';
import type { SwarmTroopersOptions } from './types.js';
export { SwarmTroopers } from './swarmtroopers.js';
export { controls, type ControlsOptions } from './controls.js';
export { tokens, type TokensOptions } from './plugins/tokens.js';
export type { ChatOptions, ChatLines, ChatKey } from './chat.js';
export type { SwarmTroopersElement, SwarmTroopersEventMap, SwarmTroopersOptions, SwarmTroopersPlugin, SwarmTroopersStats, CursorShape, PaletteSpec, Point, Quality, QualitySetting, Rect, Trigger, } from './types.js';
export type { Tool, ToolContext, ToolGen } from './tools.js';
export type { Agent, Task } from './model.js';
export type { AnnotationInit, AnnotationKind } from './overlay.js';
export declare const version: string;
/** Creates an instance on the page. Call it in the browser, once the content is in the DOM. */
export declare function create(options?: SwarmTroopersOptions): SwarmTroopers;
/** Registers a custom tool, usable as data-swarmtroopers="name". */
export declare function defineTool(name: string, tool: Tool): void;
