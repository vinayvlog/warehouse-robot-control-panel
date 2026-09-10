import { describe, expect, it } from 'vitest';

import { RECONCILE_DEADZONE, reconcile } from '../reconciliation';
import { INITIAL_ROBOT_STATE, RobotState } from '../robotSimulator';

function state(overrides: Partial<RobotState>): RobotState {
  return { ...INITIAL_ROBOT_STATE, ...overrides };
}

describe('reconcile', () => {
  it('leaves predicted state untouched when already within the deadzone', () => {
    const predicted = state({ x: 1, y: 1 });
    const authoritative = state({ x: 1 + RECONCILE_DEADZONE / 2, y: 1 });
    const result = reconcile(predicted, authoritative);
    expect(result).toEqual(predicted);
  });

  it('blends partway toward authoritative state for a moderate gap', () => {
    const predicted = state({ x: 0, y: 0 });
    const authoritative = state({ x: 1, y: 0 });
    const result = reconcile(predicted, authoritative, { blendFactor: 0.25 });
    expect(result.x).toBeCloseTo(0.25);
    expect(result.x).toBeLessThan(1); // hasn't snapped all the way
  });

  it('snaps directly when the gap is implausibly large (e.g. after a reconnect)', () => {
    const predicted = state({ x: 0, y: 0 });
    const authoritative = state({ x: 100, y: 0 });
    const result = reconcile(predicted, authoritative, { snapDistance: 5 });
    expect(result).toEqual(authoritative);
  });

  it('takes the shortest path when blending heading across the +/-pi wrap boundary', () => {
    const predicted = state({ x: 5, y: 5, heading: Math.PI - 0.1 });
    const authoritative = state({ x: 5, y: 5, heading: -Math.PI + 0.1 });
    const result = reconcile(predicted, authoritative, { blendFactor: 0.5 });
    // Correct direction is a small step forward (wrapping through pi), not
    // a huge step backward through 0.
    expect(result.heading).toBeGreaterThan(Math.PI - 0.1);
  });

  it('converges to authoritative state after repeated reconciliation steps', () => {
    let predicted = state({ x: 0, y: 0 });
    const authoritative = state({ x: 2, y: 3 });
    for (let i = 0; i < 50; i++) {
      predicted = reconcile(predicted, authoritative, { blendFactor: 0.3, deadzone: 0.001 });
    }
    expect(predicted.x).toBeCloseTo(2, 1);
    expect(predicted.y).toBeCloseTo(3, 1);
  });
});
