export declare const clamp: (v: number, lo: number, hi: number) => number;
/** Seeded PRNG (mulberry32). Deterministic when given a seed, which keeps tests stable. */
export declare function rng(seed?: number): {
    next: () => number;
    range: (lo: number, hi: number) => number;
    chance: (p: number) => boolean;
    /** Gaussian sample (Box-Muller). */
    normal: (mean?: number, sd?: number) => number;
};
export type Rng = ReturnType<typeof rng>;
type Handler<T> = (payload: T) => void;
export declare class Emitter<M extends object> {
    private handlers;
    on<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void;
    off<K extends keyof M>(type: K, fn: Handler<M[K]>): void;
    emit<K extends keyof M>(type: K, payload: M[K]): void;
    clear(): void;
}
export declare const storage: {
    get(area: "local" | "session", key: string): string | null;
    set(area: "local" | "session", key: string, value: string): void;
};
export declare function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): {
    (...args: A): void;
    cancel(): void;
};
export {};
