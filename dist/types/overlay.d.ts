import type { Agent } from './model.js';
import type { Point, Rect } from './types.js';
export type AnnotationKind = 'drag' | 'select' | 'ghost' | 'line' | 'caret' | 'ripple' | 'zone' | 'spark';
export interface AnnotationInit {
    kind: AnnotationKind;
    rect?: () => Rect;
    a?: () => Point;
    b?: () => Point;
    label?: string;
    /** Seconds before it fades out on its own. Infinite by default. */
    ttl?: number;
    color?: string;
}
export interface Annotation {
    kind: AnnotationKind;
    rect?: () => Rect;
    a?: () => Point;
    b?: () => Point;
    label?: string;
    color: string;
    ttl: number;
    age: number;
    /** Fade-out progress, 0 to 1. */
    out: number;
    closed: boolean;
    done(): void;
}
/** The closing high five. Ages in seconds; `close` counts from a dismissal, 0 while it plays. */
export interface Finale {
    age: number;
    close: number;
    /** Where the hands meet, in viewport pixels. */
    at: {
        x: number;
        y: number;
    };
    left: {
        name: string;
        color: string;
    };
    right: {
        name: string;
        color: string;
    };
}
export declare const FINALE_END: number;
export declare const FINALE_OUT = 0.3;
/** Hands wind up, make contact, then rebound once; the contact frame stays exact at every frame rate. */
export declare function finalePose(age: number): {
    spread: number;
    tilt: number;
    lift: number;
    impact: number;
};
/** Look of the overlay, read from the page. */
export interface OverlayStyle {
    /** Page background, used for halos and bubble fills. */
    halo: string;
    /** Page text colour, used in bubbles. */
    ink: string;
    /** Font family of the page, used for names and bubbles. */
    sans: string;
    /** Size multiplier for pointers, tags, bubbles and labels. */
    scale: number;
}
/** A single fixed canvas over the page. Cheap to composite, cleared only when something was drawn. */
export declare class Overlay {
    private cap;
    readonly canvas: HTMLCanvasElement;
    private ctx;
    private dart;
    private palm;
    private slap;
    private clap;
    private dpr;
    private w;
    private h;
    private painted;
    private widths;
    private wraps;
    private contrast;
    private st;
    /** Opacity of the working troopers as the completion stage enters. */
    private mul;
    constructor(z: number, cap: number);
    prepareFinale(): void;
    setCap(cap: number): void;
    resize(): void;
    destroy(): void;
    render(anns: readonly Annotation[], agents: readonly Agent[], sx: number, sy: number, style: OverlayStyle, fin?: Finale | null): void;
    /** The closing clap: two pixel cursor hands high five where the orchestrator stood. */
    private finale;
    private measure;
    /** Dark or light text, whichever reads better on the agent colour. */
    private textOn;
    private fit;
    /** A presence tab and a separate task caption keep identity stable while work changes. */
    private tag;
    private wrap;
    /** Speech bubble above the name tag, with a tail pointing at the agent. */
    private bubble;
    private annotation;
    private handles;
    private label;
    private pointer;
    /** Three-quarter hands share a straight contact edge, with the thumbs and wrists facing out. */
    private highFiveHand;
    /** One continuous outline keeps the palm and its five fingers readable even at cursor size. */
    private hand;
    private onScreen;
}
