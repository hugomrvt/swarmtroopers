import { describe, expect, it } from 'vitest';
import { fitts, minJerk, persona, planMove, pointOn, typingBudget, typingSchedule } from '../src/motion';
import { rng } from '../src/util';

describe('fitts', () => {
  it('grows with distance and shrinks with target width', () => {
    expect(fitts(800, 20)).toBeGreaterThan(fitts(100, 20));
    expect(fitts(400, 80)).toBeLessThan(fitts(400, 10));
  });
});

describe('minJerk', () => {
  it('goes from 0 to 1, symmetric and monotonic', () => {
    expect(minJerk(0)).toBe(0);
    expect(minJerk(1)).toBe(1);
    expect(minJerk(0.5)).toBeCloseTo(0.5, 10);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = minJerk(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('planMove', () => {
  const r = rng(42);
  const p = persona(r);

  it('ends exactly on the target', () => {
    const segs = planMove({ x: 0, y: 0 }, { x: 600, y: 300 }, p, r);
    const last = segs[segs.length - 1];
    expect(segs[0].from).toEqual({ x: 0, y: 0 });
    expect(pointOn(last, last.dur)).toEqual({ x: 600, y: 300 });
  });

  it('splits long aimed moves in two submovements and keeps drags in one', () => {
    expect(planMove({ x: 0, y: 0 }, { x: 900, y: 0 }, p, r)).toHaveLength(2);
    expect(planMove({ x: 0, y: 0 }, { x: 900, y: 0 }, p, r, { drag: true })).toHaveLength(1);
    expect(planMove({ x: 0, y: 0 }, { x: 60, y: 0 }, p, r)).toHaveLength(1);
    expect(planMove({ x: 5, y: 5 }, { x: 5, y: 5 }, p, r)).toHaveLength(0);
  });

  it('takes longer to reach a small target than a large one', () => {
    const small = planMove({ x: 0, y: 0 }, { x: 100, y: 0 }, p, r, { width: 6 });
    const large = planMove({ x: 0, y: 0 }, { x: 100, y: 0 }, p, r, { width: 90 });
    expect(small[0].dur).toBeGreaterThan(large[0].dur);
  });
});

describe('typing', () => {
  it('produces a monotonic schedule that fills the budget', () => {
    const text = 'Design does not survive scale, unless you industrialize it.';
    const times = typingSchedule(text, 1.5, rng(7));
    expect(times).toHaveLength(text.length);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    expect(times[times.length - 1]).toBeCloseTo(1.5, 3);
  });

  it('keeps long blocks short', () => {
    expect(typingBudget(600)).toBeLessThan(typingBudget(150) * 2);
    expect(typingBudget(150)).toBeGreaterThan(typingBudget(20));
  });
});
