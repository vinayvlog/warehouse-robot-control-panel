/**
 * Minimal differential-drive-style robot model. Pure and deterministic so it
 * can be unit tested without any networking involved, and so the client can
 * run the exact same step function locally for prediction.
 */

export interface RobotState {
  x: number;
  y: number;
  /** heading in radians */
  heading: number;
  /** current forward speed, units/sec */
  speed: number;
  /** current turn rate, radians/sec */
  turnRate: number;
}

export interface RobotCommand {
  /** -1 (full reverse) to 1 (full forward) */
  throttle: number;
  /** -1 (full left) to 1 (full right) */
  steer: number;
}

export const INITIAL_ROBOT_STATE: RobotState = {
  x: 0,
  y: 0,
  heading: 0,
  speed: 0,
  turnRate: 0,
};

const MAX_SPEED = 2.5; // units/sec
const MAX_TURN_RATE = 2.0; // radians/sec
const ACCEL = 4.0; // units/sec^2 toward target speed
const TURN_ACCEL = 6.0; // radians/sec^2 toward target turn rate

export function clampCommand(cmd: RobotCommand): RobotCommand {
  return {
    throttle: clamp(cmd.throttle, -1, 1),
    steer: clamp(cmd.steer, -1, 1),
  };
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

/**
 * Advances the robot by `dtSeconds` under the given command. Speed and turn
 * rate ease toward their targets rather than snapping, which both feels
 * more physical and makes client-side prediction visually match the server
 * closely even if tick rates differ slightly.
 */
export function step(state: RobotState, rawCmd: RobotCommand, dtSeconds: number): RobotState {
  const cmd = clampCommand(rawCmd);
  const targetSpeed = cmd.throttle * MAX_SPEED;
  const targetTurnRate = cmd.steer * MAX_TURN_RATE;

  const speed = approach(state.speed, targetSpeed, ACCEL * dtSeconds);
  const turnRate = approach(state.turnRate, targetTurnRate, TURN_ACCEL * dtSeconds);

  const heading = state.heading + turnRate * dtSeconds;
  const x = state.x + Math.cos(heading) * speed * dtSeconds;
  const y = state.y + Math.sin(heading) * speed * dtSeconds;

  return { x, y, heading, speed, turnRate };
}

function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}
