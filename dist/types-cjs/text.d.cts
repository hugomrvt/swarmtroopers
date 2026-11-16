import type { SwarmTroopersElement } from './types.cjs';
/** A word, or the part of a word on one line. Offsets are in `seq`, x in element pixels. */
export interface Piece {
    a: number;
    b: number;
    line: number;
    x0: number;
    x1: number;
}
export interface Line {
    top: number;
    bottom: number;
}
/** Geometry of the text of an element, relative to its border box. */
export interface TextGeo {
    /** Words joined by single spaces, in typing order. */
    seq: string;
    pieces: Piece[];
    lines: Line[];
    /** Top of each line's reveal band. */
    bands: number[];
    w: number;
    h: number;
    /** Margin kept around the box so glyph overhangs are not cut. */
    pad: number;
}
export interface ClipState {
    path: string;
    /** Caret position, element pixels. */
    x: number;
    top: number;
    bottom: number;
}
/** Bands between lines. When two line boxes overlap (tight leading), the overlap is split in half. */
export declare function bandsFor(lines: Line[]): number[];
/** Clip polygon showing every line above the caret, and the current line up to the caret. */
export declare function clipAt(g: TextGeo, chars: number): ClipState;
/**
 * Reads the real line boxes of an element's text with the Range API, word by word.
 * `skip` excludes text nodes that belong to another task.
 */
export declare function measureText(el: SwarmTroopersElement, skip: (node: Node) => boolean): TextGeo | null;
