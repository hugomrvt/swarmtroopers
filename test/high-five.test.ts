import { describe, expect, it } from 'vitest';
import { HIGH_FIVE_LAYERS } from '../src/high-five';
import { finalePose } from '../src/overlay';

describe('high-five artwork', () => {
  it('ships one embedded SVG per side', () => {
    expect(HIGH_FIVE_LAYERS.map((layer) => layer.group).sort()).toEqual([-1, 1]);
    for (const layer of HIGH_FIVE_LAYERS) expect(layer.src).toBeTruthy();
  });

  it('brings both hands to exact contact at the slap', () => {
    expect(finalePose(0.86)).toEqual({ spread: 0, tilt: 0, lift: 0, impact: 1 });
    expect(finalePose(0.91).spread).toBe(0);
  });
});
