import { describe, expect, it } from 'vitest';
import { HIGH_FIVE_LAYERS, HIGH_FIVE_SIZE } from '../src/high-five';
import { finalePose } from '../src/overlay';

describe('positioned high-five artwork', () => {
  it('keeps every crop inside its original transparent coordinate space', () => {
    expect(HIGH_FIVE_LAYERS).toHaveLength(2);
    for (const layer of HIGH_FIVE_LAYERS) {
      expect(layer.x).toBeGreaterThanOrEqual(0);
      expect(layer.y).toBeGreaterThanOrEqual(0);
      expect(layer.w).toBeGreaterThan(0);
      expect(layer.h).toBeGreaterThan(0);
      expect(layer.x + layer.w).toBeLessThanOrEqual(HIGH_FIVE_SIZE.width);
      expect(layer.y + layer.h).toBeLessThanOrEqual(HIGH_FIVE_SIZE.height);
    }
  });

  it('moves complete arms together and restores their authored contact pose', () => {
    expect(HIGH_FIVE_LAYERS.filter((layer) => layer.group === -1)).toHaveLength(1);
    expect(HIGH_FIVE_LAYERS.filter((layer) => layer.group === 1)).toHaveLength(1);
    expect(HIGH_FIVE_LAYERS.filter((layer) => layer.group === 0)).toHaveLength(0);
    expect(finalePose(0.86)).toEqual({ spread: 0, tilt: 0, lift: 0, impact: 1 });
    expect(finalePose(0.91).spread).toBe(0);
  });
});
