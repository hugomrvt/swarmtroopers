import { describe, expect, it } from 'vitest';
import { validateOptions } from '../src/options.js';

describe('host options boundary', () => {
  it.each([null, [], 1, 'text', { speed: 0 }, { speed: NaN }, { maxTasks: -1 }, { maxTasks: 1.5 }, { agents: { max: Infinity } }, { agents: { max: 33 } }, { palette: { count: Infinity } }, { names: [] }, { quality: 'wrong' }, { trigger: 'wrong' }, { plugins: [{}] }])('rejects unsafe options: %j', options => {
    expect(() => validateOptions(options)).toThrow();
  });
  it('accepts supported numeric boundaries and teardown-capable plugins', () => {
    expect(() => validateOptions({ maxTasks: 0, speed: 0.01, scale: 0.25, patience: 0, agents: { max: 32 }, palette: { count: 64, lightness: 1, chroma: 0 }, plugins: [{ name: 'owned', setup() { return () => undefined; } }] })).not.toThrow();
  });
});
