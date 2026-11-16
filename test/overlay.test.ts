import { describe, expect, it } from 'vitest';
import { finalePose, FINALE_END, FINALE_OUT } from '../src/overlay';

describe('closing high five', () => {
  it('has a distinct approach, exact contact, single recoil, then settles', () => {
    expect(finalePose(0.12).spread).toBeGreaterThan(finalePose(0.5).spread);
    expect(finalePose(0.66).spread).toBeGreaterThan(finalePose(0.8).spread);
    expect(finalePose(0.85).impact).toBe(0);
    expect(finalePose(0.86)).toEqual({ spread: 0, tilt: 0, lift: 0, impact: 1 });
    expect(finalePose(0.91).spread).toBe(0);
    expect(finalePose(1.05).spread).toBeGreaterThan(0);
    expect(finalePose(1.05).spread).toBeLessThan(1.7);
    expect(finalePose(1.5).spread).toBeCloseTo(0);
    expect(finalePose(1.5).impact).toBe(0);
  });

  it('stays finite for late or skipped frames and leaves within four seconds', () => {
    for (const age of [-1, 0, 0.65, 0.66, 0.86, 1.44, 10]) {
      expect(Object.values(finalePose(age)).every(Number.isFinite)).toBe(true);
      expect(finalePose(age).spread).toBeGreaterThanOrEqual(0);
      expect(finalePose(age).impact).toBeGreaterThanOrEqual(0);
      expect(finalePose(age).impact).toBeLessThanOrEqual(1);
    }
    expect(FINALE_END).toBeLessThan(4);
    expect(FINALE_OUT).toBeLessThanOrEqual(0.3);
  });
});
