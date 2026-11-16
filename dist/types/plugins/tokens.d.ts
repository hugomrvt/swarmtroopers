import type { SwarmTroopersPlugin } from '../types.js';
type Kind = 'font' | 'color' | 'space' | 'radius';
export interface TokensOptions {
    /**
     * Extra tokens, flat (`{ "color.text.strong": "#fff" }`) or in the DTCG format
     * (`{ color: { text: { strong: { $type: "color", $value: "#fff" } } } }`).
     */
    source?: Record<string, unknown>;
    /** Read the custom properties declared on :root and html. Defaults to true. */
    css?: boolean;
    /** Maximum number of tokens in one label. Defaults to 2. */
    max?: number;
}
/**
 * Labels finished elements with the design tokens that match their computed style,
 * whatever the naming convention or the toolchain that produced them.
 */
export declare function tokens(options?: TokensOptions): SwarmTroopersPlugin;
/** Guesses what a token is for from its name. Separators do not matter: --color-text-strong, color.text.strong. */
export declare function kindOf(raw: string): Kind | null;
/** Role of a colour, used to prefer the token named after that role. */
export type ColorRole = 'text' | 'background' | 'border';
/**
 * Prefers semantic names (--color-text-strong) over primitives (--gray-0) and short aliases (--white),
 * and names that match the role of the colour when one is given.
 */
export declare function pickName(names?: readonly string[], role?: ColorRole): string | null;
/** Flattens a flat or DTCG token object into [name, kind, css value]. Aliases like {color.base.white} are resolved. */
export declare function flatten(src: Record<string, unknown>): Array<[string, Kind, string]>;
export {};
