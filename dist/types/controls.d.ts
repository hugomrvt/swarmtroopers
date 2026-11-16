import type { SwarmTroopers } from './swarmtroopers.js';
import type { Quality } from './types.js';
export interface ControlsOptions {
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    labels?: Partial<Record<'title' | Quality, string>>;
    container?: Element;
}
/** A small switch that lets the reader choose Full, Light or Off. The choice is remembered. */
export declare function controls(swarmtroopers: SwarmTroopers, options?: ControlsOptions): HTMLElement;
