import { RobotCommand, RobotState } from './robotSimulator';

export interface ClientInputMessage {
  type: 'input';
  seq: number;
  cmd: RobotCommand;
  clientTimeMs: number;
}

export interface ClientPingMessage {
  type: 'ping';
  clientTimeMs: number;
}

export type ClientMessage = ClientInputMessage | ClientPingMessage;

export interface ServerWelcomeMessage {
  type: 'welcome';
  clientId: string;
  tickRateHz: number;
  networkPreset: string;
}

export interface ServerStateMessage {
  type: 'state';
  tick: number;
  lastProcessedSeq: number;
  state: RobotState;
  serverTimeMs: number;
}

export interface ServerPongMessage {
  type: 'pong';
  clientTimeMs: number;
  serverTimeMs: number;
}

export type ServerMessage = ServerWelcomeMessage | ServerStateMessage | ServerPongMessage;

export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type === 'input') {
    return (
      typeof v.seq === 'number' &&
      typeof v.clientTimeMs === 'number' &&
      typeof v.cmd === 'object' &&
      v.cmd !== null &&
      typeof (v.cmd as Record<string, unknown>).throttle === 'number' &&
      typeof (v.cmd as Record<string, unknown>).steer === 'number'
    );
  }
  if (v.type === 'ping') {
    return typeof v.clientTimeMs === 'number';
  }
  return false;
}
