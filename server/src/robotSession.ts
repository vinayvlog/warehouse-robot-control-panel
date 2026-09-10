import { INITIAL_ROBOT_STATE, RobotCommand, RobotState, step } from './robotSimulator';

/**
 * Owns one robot's authoritative state. Transport-agnostic: the WebSocket
 * layer feeds it decoded input messages and reads `getState()` /
 * `getLastAppliedSeq()` each tick to build the outgoing snapshot. Keeping it
 * free of any `ws` or network-delay code means the input-ordering logic can
 * be unit tested directly.
 */
export class RobotSession {
  private state: RobotState = { ...INITIAL_ROBOT_STATE };
  private currentCommand: RobotCommand = { throttle: 0, steer: 0 };
  private lastAppliedSeq = -1;
  private staleInputsIgnored = 0;

  /**
   * Applies an input message. Inputs are keyed by an increasing client
   * sequence number; because the simulated network can reorder packets, a
   * message that arrives after a newer one has already been applied is
   * discarded rather than rewinding the robot's command.
   */
  applyInput(seq: number, cmd: RobotCommand): void {
    if (seq <= this.lastAppliedSeq) {
      this.staleInputsIgnored += 1;
      return;
    }
    this.lastAppliedSeq = seq;
    this.currentCommand = cmd;
  }

  /** Advances the simulation by dtSeconds using the current command. */
  tick(dtSeconds: number): RobotState {
    this.state = step(this.state, this.currentCommand, dtSeconds);
    return this.state;
  }

  getState(): RobotState {
    return this.state;
  }

  getLastAppliedSeq(): number {
    return this.lastAppliedSeq;
  }

  getStaleInputsIgnored(): number {
    return this.staleInputsIgnored;
  }
}
