/**
 * Simulates an unreliable link: variable latency, packet loss, and
 * out-of-order delivery. Used to wrap both the uplink (client -> server
 * input) and downlink (server -> client snapshots) so the control panel has
 * to cope with realistic conditions rather than a clean localhost socket.
 *
 * Deterministic given an injected RNG, so behavior is unit-testable without
 * flaky timing-based assertions.
 */

export interface NetworkConditionsConfig {
  /** base one-way latency, ms */
  baseLatencyMs: number;
  /** +/- jitter added on top of the base latency, ms */
  jitterMs: number;
  /** probability (0-1) a given packet is dropped entirely */
  packetLossRate: number;
  /** probability (0-1) a packet arrives "late" (reordered), adding extra delay */
  reorderRate: number;
  /** extra delay applied to reordered packets, ms */
  reorderExtraDelayMs: number;
}

export const DEFAULT_NETWORK_CONDITIONS: NetworkConditionsConfig = {
  baseLatencyMs: 120,
  jitterMs: 80,
  packetLossRate: 0.05,
  reorderRate: 0.08,
  reorderExtraDelayMs: 250,
};

export const NETWORK_PRESETS: Record<string, NetworkConditionsConfig> = {
  clean: { baseLatencyMs: 10, jitterMs: 5, packetLossRate: 0, reorderRate: 0, reorderExtraDelayMs: 0 },
  typical_wifi: { baseLatencyMs: 60, jitterMs: 30, packetLossRate: 0.01, reorderRate: 0.02, reorderExtraDelayMs: 80 },
  warehouse_rf: DEFAULT_NETWORK_CONDITIONS,
  bad_cellular: { baseLatencyMs: 300, jitterMs: 200, packetLossRate: 0.12, reorderRate: 0.15, reorderExtraDelayMs: 500 },
};

export type Rng = () => number; // returns [0, 1)

export interface DeliveryOutcome {
  dropped: boolean;
  delayMs: number;
}

/** Pure decision function -- given config and a random source, decide what happens to one packet. */
export function decideDelivery(config: NetworkConditionsConfig, rng: Rng = Math.random): DeliveryOutcome {
  if (rng() < config.packetLossRate) {
    return { dropped: true, delayMs: 0 };
  }
  const jitter = (rng() * 2 - 1) * config.jitterMs;
  let delayMs = Math.max(0, config.baseLatencyMs + jitter);
  if (rng() < config.reorderRate) {
    delayMs += config.reorderExtraDelayMs;
  }
  return { dropped: false, delayMs };
}

export class NetworkLink {
  private config: NetworkConditionsConfig;
  private rng: Rng;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(config: NetworkConditionsConfig = DEFAULT_NETWORK_CONDITIONS, rng: Rng = Math.random) {
    this.config = config;
    this.rng = rng;
  }

  updateConfig(config: NetworkConditionsConfig): void {
    this.config = config;
  }

  getConfig(): NetworkConditionsConfig {
    return this.config;
  }

  /** Simulates sending one packet across the link. Calls `deliver` after the
   * computed delay, or never if the packet is dropped. Returns the decision
   * made, so callers can log/inspect it. */
  send(deliver: () => void): DeliveryOutcome {
    const outcome = decideDelivery(this.config, this.rng);
    if (outcome.dropped) {
      return outcome;
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      deliver();
    }, outcome.delayMs);
    this.timers.add(timer);
    return outcome;
  }

  /** Cancels all pending deliveries -- call on disconnect to avoid leaks. */
  clear(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
