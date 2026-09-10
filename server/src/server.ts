import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

import { NETWORK_PRESETS, NetworkLink } from './networkConditions';
import { isClientMessage } from './protocol';
import type { ServerMessage } from './protocol';
import { RobotSession } from './robotSession';

const PORT = Number(process.env.PORT ?? 8080);
const TICK_RATE_HZ = Number(process.env.TICK_RATE_HZ ?? 20);
const TICK_MS = 1000 / TICK_RATE_HZ;
const PRESET_NAME = process.env.NETWORK_PRESET ?? 'warehouse_rf';
const networkConfig = NETWORK_PRESETS[PRESET_NAME] ?? NETWORK_PRESETS.warehouse_rf;

const wss = new WebSocketServer({ port: PORT });

console.log(
  `[robot-mock-server] listening on ws://localhost:${PORT} | tick=${TICK_RATE_HZ}Hz | network preset="${PRESET_NAME}" ` +
    `(latency ${networkConfig.baseLatencyMs}±${networkConfig.jitterMs}ms, loss ${Math.round(networkConfig.packetLossRate * 100)}%, ` +
    `reorder ${Math.round(networkConfig.reorderRate * 100)}%)`,
);

wss.on('connection', (socket: WebSocket) => {
  const clientId = randomUUID();
  const session = new RobotSession();
  const uplink = new NetworkLink(networkConfig);
  const downlink = new NetworkLink(networkConfig);
  let tick = 0;
  let alive = true;

  const send = (message: ServerMessage) => {
    // The downlink delay/loss is applied to every outgoing message,
    // including the initial welcome, so a client can't distinguish a slow
    // handshake from a slow telemetry stream -- both go through the same
    // unkind link.
    downlink.send(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  };

  send({ type: 'welcome', clientId, tickRateHz: TICK_RATE_HZ, networkPreset: PRESET_NAME });

  socket.on('message', (raw: Buffer) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return; // malformed frame, drop silently -- a real radio link would too
    }
    if (!isClientMessage(parsed)) return;

    // Inbound messages also cross the unkind uplink before they take
    // effect, so a dropped or delayed control input behaves the way it
    // would over a real degraded connection.
    uplink.send(() => {
      if (parsed.type === 'input') {
        session.applyInput(parsed.seq, parsed.cmd);
      } else if (parsed.type === 'ping') {
        send({ type: 'pong', clientTimeMs: parsed.clientTimeMs, serverTimeMs: Date.now() });
      }
    });
  });

  const interval = setInterval(() => {
    if (!alive) return;
    session.tick(TICK_MS / 1000);
    tick += 1;
    send({
      type: 'state',
      tick,
      lastProcessedSeq: session.getLastAppliedSeq(),
      state: session.getState(),
      serverTimeMs: Date.now(),
    });
  }, TICK_MS);

  socket.on('close', () => {
    alive = false;
    clearInterval(interval);
    uplink.clear();
    downlink.clear();
  });

  socket.on('error', () => {
    alive = false;
  });
});
