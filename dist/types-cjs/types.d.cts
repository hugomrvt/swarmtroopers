import type { SwarmTroopers } from './swarmtroopers.cjs';
import type { ChatOptions } from './chat.cjs';
export type Quality = 'full' | 'light' | 'off';
export type QualitySetting = Quality | 'auto';
export type Trigger = 'immediate' | 'scroll' | 'manual';
export type CursorShape = 'arrow' | 'beam' | 'cross' | 'stamp' | 'hand';
export type SwarmTroopersElement = HTMLElement | SVGElement;
export interface Point {
    x: number;
    y: number;
}
/** A rectangle in document coordinates, in CSS pixels. */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface PaletteSpec {
    /** OKLCH hue of the first agent colour, in degrees. */
    hue?: number;
    /** Number of colours to generate. */
    count?: number;
    /** OKLCH lightness from 0 to 1. Chosen from the page background when omitted. */
    lightness?: number;
    /** OKLCH chroma. */
    chroma?: number;
}
export interface SwarmTroopersPlugin {
    name: string;
    setup?(swarmtroopers: SwarmTroopers): void | (() => void);
    /** Short annotation label for an element. Return nothing to fall back to the default label. */
    label?(el: SwarmTroopersElement, tool: string): string | null | undefined;
    /** Called when the layout changes (resize, fonts, new content). */
    invalidate?(): void;
}
export interface SwarmTroopersOptions {
    /** Element (or selector) whose content gets built. Defaults to document.body. */
    root?: Element | string | null;
    /** Elements annotated for the troopers. Defaults to "[data-swarmtroopers]". */
    selector?: string;
    /** Analyse the whole root and decide what to build, without annotations. */
    auto?: boolean;
    /** When the build starts. Defaults to "immediate". */
    trigger?: Trigger;
    /** Rendering budget. "auto" picks from the device and the reader's preferences. */
    quality?: QualitySetting;
    agents?: {
        /** Maximum number of workers on screen at once, besides the orchestrator. Defaults to 6 (3 in light). */
        max?: number;
    };
    /** Global speed multiplier. */
    speed?: number;
    /** Agent colours, as a list of CSS colours or a generated OKLCH palette. */
    palette?: string[] | PaletteSpec;
    /** Once built, an agent comes to inspect the element under the mouse. */
    inspect?: boolean;
    /** Show labels (sizes or design tokens) next to elements as they are finished. Defaults to false: labels only appear on inspection. */
    labels?: boolean;
    /** Name tag on every pointer. true (default) uses built-in first names, or pass your own list for the workers. */
    names?: boolean | string[];
    /** Language of tasks and names: "en", "fr"… Defaults to the lang attribute of the page. */
    locale?: string;
    /** Once the whole page is built, a small clap where the orchestrator stands closes the show. Defaults to true. */
    finale?: boolean;
    /** Name of the orchestrator. Defaults to "Orchestrator" or its translation. */
    leadName?: string;
    /** Seconds a visible element may wait for its squad before it simply appears. Defaults to 2.4 (1.4 on phones). */
    patience?: number;
    /** Speech bubbles for the orchestrator. Defaults to false. Lines follow the locale. */
    chat?: boolean | ChatOptions;
    /** Size of pointers, tags and bubbles. Defaults to 1.2 (1.05 on phones). */
    scale?: number;
    /** "session" builds the page once per browser session, then shows it directly. */
    once?: false | 'session';
    /** Maximum enrolled tasks. Overflow stays visible. Discovery visits at most max(100, maxTasks × 8) elements. Defaults to 400. */
    maxTasks?: number;
    /** z-index of the overlay canvas. */
    zIndex?: number;
    /** Prefix for the keys stored in localStorage and sessionStorage. Defaults to "swarmtroopers". */
    storageKey?: string;
    plugins?: Array<SwarmTroopersPlugin | 'tokens'>;
}
export interface SwarmTroopersStats {
    tasks: number;
    done: number;
    agents: number;
    active: number;
}
export interface SwarmTroopersEventMap {
    start: {
        tasks: number;
    };
    task: {
        el: SwarmTroopersElement;
        tool: string;
    };
    done: {
        tasks: number;
        agents: number;
        duration: number;
    };
    quality: {
        quality: Quality;
    };
}
