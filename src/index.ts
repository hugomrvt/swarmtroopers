import { SwarmTroopers } from './swarmtroopers.js';
import { TOOLS, type Tool } from './tools.js';
import type { SwarmTroopersOptions } from './types.js';

declare const __VERSION__: string;

export { SwarmTroopers } from './swarmtroopers.js';
export { controls, type ControlsOptions } from './controls.js';
export { tokens, type TokensOptions } from './plugins/tokens.js';
export type { ChatOptions, ChatLines, ChatKey } from './chat.js';
export type {
  SwarmTroopersElement,
  SwarmTroopersEventMap,
  SwarmTroopersOptions,
  SwarmTroopersPlugin,
  SwarmTroopersStats,
  CursorShape,
  PaletteSpec,
  Point,
  Quality,
  QualitySetting,
  Rect,
  Trigger,
} from './types.js';
export type { Tool, ToolContext, ToolGen } from './tools.js';
export type { Agent, Task } from './model.js';
export type { AnnotationInit, AnnotationKind } from './overlay.js';

export const version: string = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';

/** Creates an instance on the page. Call it in the browser, once the content is in the DOM. */
export function create(options?: SwarmTroopersOptions): SwarmTroopers {
  return new SwarmTroopers(options);
}

/** Registers a custom tool, usable as data-swarmtroopers="name". */
export function defineTool(name: string, tool: Tool): void {
  TOOLS.set(name, tool);
}
