import { NetworkLink, decideDelivery, DEFAULT_NETWORK_CONDITIONS } from '../src/networkConditions';

/** A deterministic RNG for tests: cycles through a fixed sequence of values in [0,1). */
function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

describe('decideDelivery', () => {
  it('drops a packet when the RNG falls under the loss rate', () => {
    const config = { ...DEFAULT_NETWORK_CONDITIONS, packetLossRate: 0.5 };
    const outcome = decideDelivery(config, sequenceRng([0.1])); // 0.1 < 0.5 -> dropped
    expect(outcome.dropped).toBe(true);
  });

  it('does not drop a packet when the RNG is above the loss rate', () => {
    const config = { ...DEFAULT_NETWORK_CONDITIONS, packetLossRate: 0.1 };
    const outcome = decideDelivery(config, sequenceRng([0.9, 0.5, 0.9]));
    expect(outcome.dropped).toBe(false);
  });

  it('computes delay as base latency plus jitter', () => {
    const config = { baseLatencyMs: 100, jitterMs: 50, packetLossRate: 0, reorderRate: 0, reorderExtraDelayMs: 0 };
    // rng sequence: [lossCheck=0.9 (no drop), jitterRoll=1.0 (max positive jitter), reorderCheck=0.9 (no reorder)]
    const outcome = decideDelivery(config, sequenceRng([0.9, 1.0, 0.9]));
    expect(outcome.dropped).toBe(false);
    expect(outcome.delayMs).toBeCloseTo(150); // 100 + (1.0*2-1)*50 = 100+50
  });

  it('never returns a negative delay even with large negative jitter', () => {
    const config = { baseLatencyMs: 10, jitterMs: 50, packetLossRate: 0, reorderRate: 0, reorderExtraDelayMs: 0 };
    const outcome = decideDelivery(config, sequenceRng([0.9, 0.0, 0.9])); // jitter = -50
    expect(outcome.delayMs).toBeGreaterThanOrEqual(0);
  });

  it('adds extra delay when the reorder roll succeeds', () => {
    const config = { baseLatencyMs: 50, jitterMs: 0, packetLossRate: 0, reorderRate: 1, reorderExtraDelayMs: 200 };
    const outcome = decideDelivery(config, sequenceRng([0.9, 0.5, 0.0])); // reorderCheck=0.0 < rate(1) -> reordered
    expect(outcome.delayMs).toBeCloseTo(250);
  });
});

describe('NetworkLink', () => {
  jest.useFakeTimers();

  it('delivers a packet after the computed delay', () => {
    const config = { baseLatencyMs: 100, jitterMs: 0, packetLossRate: 0, reorderRate: 0, reorderExtraDelayMs: 0 };
    const link = new NetworkLink(config, sequenceRng([0.9, 0.5]));
    const deliver = jest.fn();

    link.send(deliver);
    expect(deliver).not.toHaveBeenCalled();

    jest.advanceTimersByTime(99);
    expect(deliver).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('never calls deliver for a dropped packet', () => {
    const config = { ...DEFAULT_NETWORK_CONDITIONS, packetLossRate: 1 };
    const link = new NetworkLink(config, sequenceRng([0.0]));
    const deliver = jest.fn();

    link.send(deliver);
    jest.advanceTimersByTime(10_000);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('can reorder delivery relative to send order under high jitter', () => {
    // First packet gets a long delay, second a short one -- second should
    // arrive first, demonstrating out-of-order delivery is possible.
    const config = { baseLatencyMs: 100, jitterMs: 0, packetLossRate: 0, reorderRate: 0, reorderExtraDelayMs: 0 };
    const link = new NetworkLink(config, sequenceRng([0.9, 0.5]));
    const order: string[] = [];

    // Manually vary delay per-call by swapping config between sends.
    link.updateConfig({ ...config, baseLatencyMs: 300 });
    link.send(() => order.push('first'));
    link.updateConfig({ ...config, baseLatencyMs: 50 });
    link.send(() => order.push('second'));

    jest.advanceTimersByTime(300);
    expect(order).toEqual(['second', 'first']);
  });

  it('clear() cancels pending deliveries', () => {
    const config = { baseLatencyMs: 100, jitterMs: 0, packetLossRate: 0, reorderRate: 0, reorderExtraDelayMs: 0 };
    const link = new NetworkLink(config, sequenceRng([0.9, 0.5]));
    const deliver = jest.fn();

    link.send(deliver);
    link.clear();
    jest.advanceTimersByTime(10_000);
    expect(deliver).not.toHaveBeenCalled();
  });
});
