import { describe, expect, it } from 'vitest';
import { buildPalette, oklchToRgb, relativeLuminance, toHex, type RGB } from '../src/palette';

const rgbOf = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;

describe('palette', () => {
  it('converts OKLCH white and black', () => {
    expect(oklchToRgb(1, 0, 0)).toEqual([255, 255, 255]);
    expect(oklchToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it('reports colours outside sRGB', () => {
    expect(oklchToRgb(0.9, 0.4, 140)).toBeNull();
  });

  it('builds distinct, valid hex colours', () => {
    const p = buildPalette({ count: 8 });
    expect(p).toHaveLength(8);
    expect(new Set(p).size).toBe(8);
    for (const c of p) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps every colour at the requested lightness, brighter for dark pages', () => {
    const avg = (xs: string[]): number => xs.reduce((s, c) => s + relativeLuminance(rgbOf(c)), 0) / xs.length;
    expect(avg(buildPalette({ lightness: 0.76 }))).toBeGreaterThan(avg(buildPalette({ lightness: 0.6 })));
  });

  it('formats hex', () => {
    expect(toHex([255, 106, 0])).toBe('#ff6a00');
  });
});
