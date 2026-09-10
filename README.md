# Warehouse Robot Control Panel

A browser-based control panel for driving a warehouse robot over a network
that is slow and drops packets, plus a mock robot server that simulates
exactly that kind of link. Built for the Zenalyst AI full-stack assignment.

## The two requirements this is built around

1. **Feels instant despite a bad network.** The client runs the same robot
   physics locally as the server does, applying every keypress immediately
   (client-side prediction) and then continuously blending toward the
   server's authoritative state as it arrives (reconciliation), instead of
   freezing or snapping while waiting on a round trip.
2. **Operator keys are changeable while driving, not in a config file.**
   Click any binding in the Controls panel, press a new key, and it's live
   immediately — including for a key you're currently holding down. Bindings
   persist to `localStorage`, not a source file.

## Project layout

```
server/   Mock robot WebSocket server (TypeScript, Node, ws)
client/   Control panel (React + TypeScript, Vite)
```

## How the mock server is "realistically unkind"

`server/src/networkConditions.ts` wraps every message in both directions
(operator input going up, telemetry coming down) in a simulated link with:

- **Latency + jitter** — a base delay plus random variance per packet
- **Packet loss** — a configurable percentage of packets vanish entirely
- **Reordering** — some packets get an extra delay, so they can arrive after
  packets sent later

Four presets are built in (`server/src/networkConditions.ts`):
`clean`, `typical_wifi`, `warehouse_rf` (default), `bad_cellular`. Pick one
via the `NETWORK_PRESET` environment variable.

## How the client stays responsive

- `useRobotConnection` predicts locally every animation frame using the
  exact same `step()` physics function the server uses
  (`client/src/lib/robotSimulator.ts`, mirrored from `server/src/robotSimulator.ts`).
- When a server snapshot arrives, the predicted state is blended toward it
  (`reconcile()`) rather than snapped, so latency spikes don't cause visible
  jumps. A snapshot that's wildly far off (e.g. after a reconnect) still
  snaps, since blending slowly would look like sliding across the floor.
- The current command is resent every 150ms even if unchanged (a
  heartbeat), so a dropped "stop" packet self-corrects on the next resend
  instead of leaving the robot stuck driving.
- If no server message has arrived in over a second, the UI flags the
  connection as **stale** — an operator seeing a stuck-looking robot needs to
  know whether it's actually stopped or whether they're just not getting
  telemetry.
- The WebSocket reconnects automatically with exponential backoff if the
  connection drops.

## Install and run locally (no Docker)

Requires Node.js 20+.

### 1. Start the mock server

```bash
cd server
npm install
npm run dev
```

This starts a WebSocket server on `ws://localhost:8080` using the
`warehouse_rf` network preset by default. Useful environment variables:

| Variable         | Default        | Meaning                                              |
|-------------------|---------------|-------------------------------------------------------|
| `PORT`            | `8080`        | WebSocket port                                        |
| `TICK_RATE_HZ`    | `20`           | Physics/broadcast tick rate                            |
| `NETWORK_PRESET`  | `warehouse_rf` | One of `clean`, `typical_wifi`, `warehouse_rf`, `bad_cellular` |

### 2. Start the client

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the printed URL (defaults to `http://localhost:5173`). The client
connects to `ws://localhost:8080` by default; override with a `.env` file
in `client/` containing `VITE_ROBOT_WS_URL=ws://your-host:8080`.

### 3. Drive it

Default bindings: **W/S** forward/back, **A/D** turn, **Space** stop. Click
any binding in the Controls panel and press a new key to rebind it on the
spot.

## Run with Docker Compose

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

- Server: `ws://localhost:8080`
- Client: `http://localhost:5173`

Change the simulated network conditions by editing `NETWORK_PRESET` under
`robot-server` in `docker-compose.yml` and re-running `docker compose up --build`.

## Running the tests

```bash
# Server: physics, network-condition simulation, input-ordering logic
cd server && npm test

# Client: reconciliation blending, key-binding persistence/rebinding/control-vector logic
cd client && npm test
```

Both suites are pure-logic unit tests (no real sockets, no real timers —
Jest fake timers and an injectable RNG make the network simulation
deterministic) so they run fast and don't flake. `npx tsc --noEmit` in
either folder type-checks without emitting.

CI (`.github/workflows/ci.yml`) runs both suites plus a production build on
every push and pull request.

## Notable design decisions / trade-offs

- **Physics duplication.** `robotSimulator.ts` is intentionally duplicated
  between `client/src/lib` and `server/src`, kept in sync by hand. In a
  larger project this would be a shared npm package; duplicating a ~50-line
  pure function was the simpler call for a two-service take-home project.
- **Continuous command, not per-tick input queue.** Because driving is
  analog/continuous (held keys), the server just keeps applying the last
  known command every tick, rather than the discrete "replay a queue of
  inputs" pattern used in most multiplayer game netcode. This is simpler and
  fits the domain; the trade-off is that a lost "start moving" or "stop"
  message only self-corrects on the next heartbeat resend (150ms), not
  instantly.
- **No WebSocket proxying through nginx in Docker.** The client container
  serves static files only; the browser talks to the server container
  directly on its exposed port. This keeps the nginx config trivial at the
  cost of requiring the server's port to be reachable from the browser
  (fine for local Docker Compose; would need a proper reverse proxy for a
  real deployment).
