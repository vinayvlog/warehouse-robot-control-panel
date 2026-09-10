import { INITIAL_ROBOT_STATE, step } from '../src/robotSimulator';

describe('robotSimulator.step', () => {
  it('stays put with zero command', () => {
    const next = step(INITIAL_ROBOT_STATE, { throttle: 0, steer: 0 }, 1);
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(0);
    expect(next.speed).toBeCloseTo(0);
  });

  it('accelerates forward under positive throttle and moves along heading 0 on +x', () => {
    let state = INITIAL_ROBOT_STATE;
    for (let i = 0; i < 50; i++) {
      state = step(state, { throttle: 1, steer: 0 }, 0.05);
    }
    expect(state.speed).toBeGreaterThan(0);
    expect(state.x).toBeGreaterThan(0);
    expect(state.y).toBeCloseTo(0, 1);
  });

  it('turns under steer input, changing heading over time', () => {
    let state = INITIAL_ROBOT_STATE;
    for (let i = 0; i < 20; i++) {
      state = step(state, { throttle: 0.5, steer: 1 }, 0.05);
    }
    expect(state.heading).toBeGreaterThan(0);
  });

  it('clamps out-of-range throttle/steer instead of exploding', () => {
    const next = step(INITIAL_ROBOT_STATE, { throttle: 50, steer: -99 }, 1);
    expect(Number.isFinite(next.speed)).toBe(true);
    expect(Math.abs(next.speed)).toBeLessThanOrEqual(2.5 + 1e-6);
  });

  it('treats NaN command components as zero rather than propagating NaN', () => {
    const next = step(INITIAL_ROBOT_STATE, { throttle: NaN, steer: 0 }, 1);
    expect(Number.isNaN(next.speed)).toBe(false);
  });

  it('eases speed toward target rather than snapping instantly', () => {
    const afterOneTick = step(INITIAL_ROBOT_STATE, { throttle: 1, steer: 0 }, 0.05);
    expect(afterOneTick.speed).toBeLessThan(2.5); // hasn't reached max speed in one 50ms tick
    expect(afterOneTick.speed).toBeGreaterThan(0);
  });
});
