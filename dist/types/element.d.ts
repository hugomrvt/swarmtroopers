import { SwarmTroopers } from './swarmtroopers.js';
declare const Base: typeof HTMLElement;
/**
 * Declarative use, from any template language or framework:
 * <swarmtroopers-overlay auto inspect tokens controls quality="light" trigger="scroll" root="main"></swarmtroopers-overlay>
 */
export declare class SwarmTroopersOverlayElement extends Base {
    swarmtroopers: SwarmTroopers | null;
    private pendingStart;
    connectedCallback(): void;
    disconnectedCallback(): void;
}
export declare function defineElement(name?: string): void;
export {};
