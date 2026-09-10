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

export function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as Record<string, unknown>).type;
  return type === 'welcome' || type === 'state' || type === 'pong';
}
