import { RobotSession } from '../src/robotSession';

describe('RobotSession', () => {
  it('starts at rest', () => {
    const session = new RobotSession();
    expect(session.getState()).toEqual({ x: 0, y: 0, heading: 0, speed: 0, turnRate: 0 });
    expect(session.getLastAppliedSeq()).toBe(-1);
  });

  it('applies an input and reflects it on the next tick', () => {
    const session = new RobotSession();
    session.applyInput(1, { throttle: 1, steer: 0 });
    session.tick(0.1);
    expect(session.getLastAppliedSeq()).toBe(1);
    expect(session.getState().speed).toBeGreaterThan(0);
  });

  it('ignores a stale input that arrives after a newer one was already applied', () => {
    const session = new RobotSession();
    session.applyInput(5, { throttle: 1, steer: 0 });
    session.applyInput(2, { throttle: -1, steer: 0 }); // arrived late/out of order
    expect(session.getLastAppliedSeq()).toBe(5);
    session.tick(0.1);
    expect(session.getState().speed).toBeGreaterThan(0); // still driven by seq=5's forward throttle
  });

  it('counts stale/duplicate inputs it discards', () => {
    const session = new RobotSession();
    session.applyInput(3, { throttle: 1, steer: 0 });
    session.applyInput(3, { throttle: -1, steer: 0 }); // duplicate seq
    session.applyInput(1, { throttle: -1, steer: 0 }); // older seq
    expect(session.getStaleInputsIgnored()).toBe(2);
  });

  it('keeps applying the last known command across ticks with no new input', () => {
    const session = new RobotSession();
    session.applyInput(1, { throttle: 1, steer: 0 });
    session.tick(0.05);
    const afterFirst = session.getState().speed;
    session.tick(0.05); // no new input between ticks
    const afterSecond = session.getState().speed;
    expect(afterSecond).toBeGreaterThan(afterFirst); // still accelerating under the same held command
  });
});
