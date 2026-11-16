export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Seeded PRNG (mulberry32). Deterministic when given a seed, which keeps tests stable. */
export function rng(seed: number = (Math.random() * 4294967296) >>> 0) {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number): number => lo + next() * (hi - lo),
    chance: (p: number): boolean => next() < p,
    /** Gaussian sample (Box-Muller). */
    normal: (mean = 0, sd = 1): number => {
      let u = 0;
      while (u === 0) u = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
  };
}
export type Rng = ReturnType<typeof rng>;

type Handler<T> = (payload: T) => void;

export class Emitter<M extends object> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => this.off(type, fn);
  }

  off<K extends keyof M>(type: K, fn: Handler<M[K]>): void {
    this.handlers.get(type)?.delete(fn);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    this.handlers.get(type)?.forEach((fn) => {
      try {
        (fn as Handler<M[K]>)(payload);
      } catch (err) {
        console.error('[swarmtroopers]', err);
      }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const storage = {
  get(area: 'local' | 'session', key: string): string | null {
    try {
      return (area === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(area: 'local' | 'session', key: string, value: string): void {
    try {
      (area === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value);
    } catch {
      /* storage blocked: the preference simply is not remembered */
    }
  },
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (...args: A): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  run.cancel = (): void => clearTimeout(timer);
  return run;
}
