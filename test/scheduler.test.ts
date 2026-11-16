import { describe, expect, it } from 'vitest';
import { byPriority, pickTask } from '../src/scheduler';
import { flatten, kindOf, pickName } from '../src/plugins/tokens';

describe('scheduler', () => {
  it('puts visible work first, then reading order', () => {
    const list = [
      { order: 3, inView: false },
      { order: 2, inView: true },
      { order: 1, inView: false },
      { order: 0, inView: true },
    ];
    expect(list.sort(byPriority).map((t) => t.order)).toEqual([0, 2, 1, 3]);
  });

  it('prefers the nearest of the first candidates', () => {
    const tasks = [
      { id: 'a', p: { x: 1000, y: 0 } },
      { id: 'b', p: { x: 10, y: 0 } },
      { id: 'c', p: { x: 0, y: 0 } },
    ];
    expect(pickTask(tasks, { x: 0, y: 0 }, 2, (t) => t.p)?.id).toBe('b');
    expect(pickTask<{ p: { x: number; y: number } }>([], { x: 0, y: 0 }, 2, (t) => t.p)).toBeNull();
  });
});

describe('tokens', () => {
  it('guesses kinds from names, whatever the separators', () => {
    expect(kindOf('--color-text-strong')).toBe('color');
    expect(kindOf('color.text.strong')).toBe('color');
    expect(kindOf('--text-4xl')).toBe('font');
    expect(kindOf('--space-8')).toBe('space');
    expect(kindOf('--radius-md')).toBe('radius');
    expect(kindOf('--duration-fast')).toBeNull();
    expect(kindOf('--font-sans')).toBeNull();
  });

  it('prefers semantic names', () => {
    expect(pickName(['--white', '--gray-0', '--color-text-strong'])).toBe('--color-text-strong');
  });

  it('reads DTCG and flat sources, with aliases', () => {
    const out = flatten({
      color: { base: { white: { $type: 'color', $value: '#ffffff' } }, text: { strong: { $type: 'color', $value: '{color.base.white}' } } },
      space: { $type: 'dimension', '4': { $value: { value: 16, unit: 'px' } } },
      'radius.md': '8px',
    });
    expect(out).toContainEqual(['color.text.strong', 'color', '#ffffff']);
    expect(out).toContainEqual(['space.4', 'space', '16px']);
    expect(out).toContainEqual(['radius.md', 'radius', '8px']);
  });
});
