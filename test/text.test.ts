import { describe, expect, it } from 'vitest';
import { bandsFor, clipAt, type TextGeo } from '../src/text';

const lines = [
  { top: 0, bottom: 20 },
  { top: 18, bottom: 38 },
];

const geo: TextGeo = {
  seq: 'Hello world again',
  pieces: [
    { a: 0, b: 5, line: 0, x0: 0, x1: 50 },
    { a: 6, b: 11, line: 0, x0: 56, x1: 106 },
    { a: 12, b: 17, line: 1, x0: 0, x1: 52 },
  ],
  lines,
  bands: bandsFor(lines),
  w: 120,
  h: 40,
  pad: 4,
};

describe('text reveal', () => {
  it('splits overlapping line boxes in the middle', () => {
    expect(geo.bands).toEqual([0, 19]);
  });

  it('starts on the first glyph', () => {
    const s = clipAt(geo, 0);
    expect(s.x).toBe(0);
    expect(s.top).toBe(0);
  });

  it('advances through words, then to the next line', () => {
    expect(clipAt(geo, 3).x).toBeCloseTo(30);
    expect(clipAt(geo, 5).x).toBe(56);
    const s = clipAt(geo, 14);
    expect(s.top).toBe(18);
    expect(s.x).toBeCloseTo(52 * 0.4);
    expect(s.path.startsWith('polygon(')).toBe(true);
    expect(s.path).toContain('19px');
  });

  it('clamps past the end', () => {
    expect(clipAt(geo, 999).x).toBe(52);
  });
});
