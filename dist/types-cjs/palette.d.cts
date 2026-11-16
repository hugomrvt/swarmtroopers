import type { PaletteSpec } from './types.cjs';
export type RGB = [number, number, number];
/** OKLCH to sRGB (0 to 255). Returns null when the colour falls outside the sRGB gamut. */
export declare function oklchToRgb(l: number, c: number, hueDeg: number): RGB | null;
export declare const toHex: (c: RGB) => string;
/** Golden-angle hue steps keep consecutive agents easy to tell apart. Chroma drops until each colour fits sRGB. */
export declare function buildPalette(spec?: PaletteSpec): string[];
/** WCAG relative luminance. */
export declare function relativeLuminance([r, g, b]: RGB): number;
/** Resolves any colour the browser understands (lab, oklch, color-mix…) to sRGB through a 1×1 canvas. */
export declare function cssToRgba(css: string): [number, number, number, number];
/** Background colour the reader actually sees behind the content. */
export declare function pageBackground(): RGB;
