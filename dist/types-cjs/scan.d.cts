import type { SwarmTroopersElement } from './types.cjs';
export interface Draft {
    el: SwarmTroopersElement;
    tool: string;
    parent: Draft | null;
    source: Draft | null;
}
export interface ScanOptions {
    auto: boolean;
    selector: string;
    maxTasks: number;
    known?(el: Element): boolean;
}
/** Alpha channel of a computed colour, whatever its syntax (rgb, rgba, color(), lab()…). */
export declare function alphaOf(color: string): number;
/** Does the element paint a box of its own: background, border or shadow? */
export declare function hasBox(cs: CSSStyleDeclaration): boolean;
/**
 * Turns the DOM into a list of drafts in reading order.
 * Annotated elements use their data-swarmtroopers value. In auto mode (or inside data-swarmtroopers="scan")
 * every element is classified from its computed style.
 */
export declare function scan(root: Element, o: ScanOptions): Draft[];
