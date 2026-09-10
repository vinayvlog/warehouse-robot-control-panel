import { RobotState } from './robotSimulator';

/**
 * How far apart predicted and authoritative state have to be before we
 * bother correcting at all. Below this, the mismatch is imperceptible and
 * "correcting" it would just add jitter.
 */
export const RECONCILE_DEADZONE = 0.02;

/** Fraction of the remaining gap closed per correction step (0-1). Higher
 * = snappier correction, lower = smoother but slower to converge. */
export const RECONCILE_BLEND_FACTOR = 0.25;

function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Nudges `predicted` toward `authoritative` by RECONCILE_BLEND_FACTOR of the
 * remaining gap, or snaps directly if the gap is below the deadzone (i.e.
 * already converged) or implausibly large (e.g. after a reconnect, where
 * blending slowly would look like the robot sliding across the floor).
 */
export function reconcile(
  predicted: RobotState,
  authoritative: RobotState,
  options: { blendFactor?: number; deadzone?: number; snapDistance?: number } = {},
): RobotState {
  const blendFactor = options.blendFactor ?? RECONCILE_BLEND_FACTOR;
  const deadzone = options.deadzone ?? RECONCILE_DEADZONE;
  const snapDistance = options.snapDistance ?? 5;

  const dx = authoritative.x - predicted.x;
  const dy = authoritative.y - predicted.y;
  const distance = Math.hypot(dx, dy);
  const headingDiff = shortestAngleDiff(predicted.heading, authoritative.heading);

  if (distance > snapDistance) {
    // Too far off to blend convincingly (likely a reconnect or long stall) -- snap.
    return { ...authoritative };
  }

  // Position and heading are corrected independently: a robot that's
  // exactly where the server thinks it is but facing the wrong way (or
  // vice versa) still needs the mismatched component nudged.
  const x = distance < deadzone ? predicted.x : lerp(predicted.x, authoritative.x, blendFactor);
  const y = distance < deadzone ? predicted.y : lerp(predicted.y, authoritative.y, blendFactor);
  const heading =
    Math.abs(headingDiff) < deadzone ? predicted.heading : predicted.heading + headingDiff * blendFactor;

  return {
    x,
    y,
    heading,
    speed: lerp(predicted.speed, authoritative.speed, blendFactor),
    turnRate: lerp(predicted.turnRate, authoritative.turnRate, blendFactor),
  };
}
