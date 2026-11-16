import type { SwarmTroopersOptions } from './types.js';

/** Validate before touching host DOM; JSON and JavaScript callers do not have TypeScript's checks. */
export function validateOptions(input: unknown): asserts input is SwarmTroopersOptions {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('[swarmtroopers] options must be an object');
  const o = input as Record<string, unknown>;
  const number = (value: unknown, name: string, min: number, max = Infinity, integer = false): void => {
    if (value === undefined) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new TypeError(`[swarmtroopers] ${name} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}`);
    }
  };
  const choice = (name: string, values: unknown[]): void => {
    if (o[name] !== undefined && !values.includes(o[name])) throw new TypeError(`[swarmtroopers] invalid ${name}`);
  };
  choice('quality', ['auto', 'full', 'light', 'off']);
  choice('trigger', ['immediate', 'scroll', 'manual']);
  choice('once', [false, 'session']);
  for (const name of ['auto', 'inspect', 'labels', 'finale']) {
    if (o[name] !== undefined && typeof o[name] !== 'boolean') throw new TypeError(`[swarmtroopers] ${name} must be a boolean`);
  }
  for (const name of ['selector', 'storageKey', 'locale', 'leadName']) {
    if (o[name] !== undefined && (typeof o[name] !== 'string' || !(o[name] as string).trim())) throw new TypeError(`[swarmtroopers] ${name} must be a non-empty string`);
  }
  number(o.speed, 'speed', 0.01, 100);
  number(o.scale, 'scale', 0.25, 4);
  number(o.patience, 'patience', 0);
  number(o.maxTasks, 'maxTasks', 0, 10000, true);
  number(o.zIndex, 'zIndex', 0, 2147483647, true);
  if (o.agents !== undefined) {
    if (!o.agents || typeof o.agents !== 'object' || Array.isArray(o.agents)) throw new TypeError('[swarmtroopers] agents must be an object');
    number((o.agents as { max?: unknown }).max, 'agents.max', 1, 32, true);
  }
  if (o.names !== undefined && typeof o.names !== 'boolean' && (!Array.isArray(o.names) || !o.names.length || o.names.some(n => typeof n !== 'string' || !n.trim()))) throw new TypeError('[swarmtroopers] names must be a boolean or a non-empty list of names');
  if (o.palette !== undefined) {
    const p = o.palette;
    if (Array.isArray(p)) {
      if (!p.length || p.some(c => typeof c !== 'string' || !CSS.supports('color', c))) throw new TypeError('[swarmtroopers] palette must contain CSS colors');
    } else {
      if (!p || typeof p !== 'object') throw new TypeError('[swarmtroopers] palette must be a list or specification');
      const spec = p as Record<string, unknown>;
      number(spec.count, 'palette.count', 1, 64, true);
      number(spec.hue, 'palette.hue', -360000, 360000);
      number(spec.lightness, 'palette.lightness', 0, 1);
      number(spec.chroma, 'palette.chroma', 0, 1);
    }
  }
  if (o.chat !== undefined && typeof o.chat !== 'boolean' && (!o.chat || typeof o.chat !== 'object' || Array.isArray(o.chat))) throw new TypeError('[swarmtroopers] chat must be a boolean or an object');
  if (o.plugins !== undefined) {
    if (!Array.isArray(o.plugins) || o.plugins.some(p => p !== 'tokens' && (!p || typeof p !== 'object' || typeof p.name !== 'string' || ['setup', 'invalidate', 'label'].some(k => p[k] !== undefined && typeof p[k] !== 'function')))) throw new TypeError('[swarmtroopers] invalid plugin');
  }
}

export function resolveRoot(root: SwarmTroopersOptions['root']): Element {
  if (typeof document === 'undefined') throw new Error('[swarmtroopers] create() requires a browser document');
  const element = typeof root === 'string' ? document.querySelector(root) : root ?? document.body;
  if (!(element instanceof Element)) throw new TypeError('[swarmtroopers] root must resolve to an existing Element; create after it mounts');
  return element;
}
