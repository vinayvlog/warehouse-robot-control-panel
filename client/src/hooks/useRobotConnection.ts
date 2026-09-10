import { useCallback, useEffect, useRef, useState } from 'react';

import { reconcile } from '../lib/reconciliation';
import { ClientMessage, ServerMessage, isServerMessage } from '../lib/protocol';
import { ControlVector } from '../lib/keyBindings';
import { INITIAL_ROBOT_STATE, RobotState, step } from '../lib/robotSimulator';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

const HEARTBEAT_MS = 150; // resend the current command this often even if unchanged
const PING_INTERVAL_MS = 1000;
const STALE_AFTER_MS = 1200; // no server message in this long => flag as stale
const MAX_BACKOFF_MS = 8000;

export interface ConnectionInfo {
  status: ConnectionStatus;
  rttMs: number | null;
  tickRateHz: number | null;
  networkPreset: string | null;
  isStale: boolean;
  lastProcessedSeq: number;
}

export function useRobotConnection(url: string) {
  const [displayState, setDisplayState] = useState<RobotState>(INITIAL_ROBOT_STATE);
  const [info, setInfo] = useState<ConnectionInfo>({
    status: 'connecting',
    rttMs: null,
    tickRateHz: null,
    networkPreset: null,
    isStale: false,
    lastProcessedSeq: -1,
  });

  const predictedRef = useRef<RobotState>(INITIAL_ROBOT_STATE);
  const authoritativeRef = useRef<RobotState>(INITIAL_ROBOT_STATE);
  const commandRef = useRef<ControlVector>({ throttle: 0, steer: 0 });
  const seqRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const lastMessageAtRef = useRef<number>(Date.now());
  const lastFrameAtRef = useRef<number>(performance.now());
  const reconnectAttemptRef = useRef(0);
  const closedByUsRef = useRef(false);

  const setCommand = useCallback((cmd: ControlVector) => {
    commandRef.current = cmd;
    sendInput(); // send immediately on change for the lowest possible input latency
  }, []);

  const sendInput = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    seqRef.current += 1;
    const message: ClientMessage = {
      type: 'input',
      seq: seqRef.current,
      cmd: commandRef.current,
      clientTimeMs: Date.now(),
    };
    ws.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let staleCheckTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let rafId: number | undefined;

    function connect() {
      if (cancelled) return;
      setInfo((prev) => ({ ...prev, status: reconnectAttemptRef.current === 0 ? 'connecting' : 'reconnecting' }));

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        lastMessageAtRef.current = Date.now();
        setInfo((prev) => ({ ...prev, status: 'open', isStale: false }));
      };

      ws.onmessage = (event) => {
        lastMessageAtRef.current = Date.now();
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!isServerMessage(parsed)) return;
        handleServerMessage(parsed);
      };

      ws.onclose = () => {
        if (cancelled || closedByUsRef.current) return;
        setInfo((prev) => ({ ...prev, status: 'reconnecting' }));
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function scheduleReconnect() {
      const attempt = reconnectAttemptRef.current;
      const backoff = Math.min(MAX_BACKOFF_MS, 250 * 2 ** attempt) + Math.random() * 200;
      reconnectAttemptRef.current += 1;
      reconnectTimer = setTimeout(connect, backoff);
    }

    function handleServerMessage(message: ServerMessage) {
      if (message.type === 'welcome') {
        setInfo((prev) => ({ ...prev, tickRateHz: message.tickRateHz, networkPreset: message.networkPreset }));
        return;
      }
      if (message.type === 'state') {
        authoritativeRef.current = message.state;
        setInfo((prev) => ({ ...prev, lastProcessedSeq: message.lastProcessedSeq }));
        return;
      }
      if (message.type === 'pong') {
        const rtt = Date.now() - message.clientTimeMs;
        setInfo((prev) => ({ ...prev, rttMs: rtt }));
      }
    }

    function frame() {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrameAtRef.current) / 1000); // clamp huge gaps (tab backgrounded)
      lastFrameAtRef.current = now;

      // Local prediction always runs, independent of network state -- this
      // is what makes input feel instant even when packets are slow.
      predictedRef.current = step(predictedRef.current, commandRef.current, dt);
      // Continuously pull the predicted state toward the last known
      // authoritative snapshot rather than snapping the moment one arrives.
      predictedRef.current = reconcile(predictedRef.current, authoritativeRef.current);
      setDisplayState(predictedRef.current);

      rafId = requestAnimationFrame(frame);
    }

    connect();
    rafId = requestAnimationFrame(frame);
    heartbeatTimer = setInterval(sendInput, HEARTBEAT_MS);
    pingTimer = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', clientTimeMs: Date.now() } satisfies ClientMessage));
      }
    }, PING_INTERVAL_MS);
    staleCheckTimer = setInterval(() => {
      const stale = Date.now() - lastMessageAtRef.current > STALE_AFTER_MS;
      setInfo((prev) => (prev.isStale === stale ? prev : { ...prev, isStale: stale }));
    }, 300);

    return () => {
      cancelled = true;
      closedByUsRef.current = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (staleCheckTimer) clearInterval(staleCheckTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [url, sendInput]);

  return { state: displayState, info, setCommand };
}
