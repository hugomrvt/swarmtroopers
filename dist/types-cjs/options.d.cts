import type { SwarmTroopersOptions } from './types.cjs';
/** Validate before touching host DOM; JSON and JavaScript callers do not have TypeScript's checks. */
export declare function validateOptions(input: unknown): asserts input is SwarmTroopersOptions;
export declare function resolveRoot(root: SwarmTroopersOptions['root']): Element;
