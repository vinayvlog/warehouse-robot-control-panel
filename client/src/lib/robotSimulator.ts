/**
 * Mirrors server/src/robotSimulator.ts exactly. Client-side prediction only
 * feels seamless if it runs the same model the server uses to produce the
 * authoritative state it will later reconcile against. In a larger project
 * this file would live in a shared package; duplicated here to keep the
 * client and mock server independently deployable for this exercise.
 */

export interface RobotState {
  x: number;
  y: number;
  heading: number;
  speed: number;
  turnRate: number;
}

export interface RobotCommand {
  throttle: number;
  steer: number;
}

export const INITIAL_ROBOT_STATE: RobotState = {
  x: 0,
  y: 0,
  heading: 0,
  speed: 0,
  turnRate: 0,
};

const MAX_SPEED = 2.5;
const MAX_TURN_RATE = 2.0;
const ACCEL = 4.0;
const TURN_ACCEL = 6.0;

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

export function clampCommand(cmd: RobotCommand): RobotCommand {
  return { throttle: clamp(cmd.throttle, -1, 1), steer: clamp(cmd.steer, -1, 1) };
}

function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

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
