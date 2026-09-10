import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_KEY_BINDINGS,
  computeControlVector,
  loadKeyBindings,
  rebind,
  saveKeyBindings,
} from '../keyBindings';

function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('loadKeyBindings', () => {
  it('returns defaults when nothing has been saved', () => {
    expect(loadKeyBindings(fakeStorage())).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('returns saved bindings written by saveKeyBindings', () => {
    const storage = fakeStorage();
    const custom = { ...DEFAULT_KEY_BINDINGS, forward: 'ArrowUp' };
    saveKeyBindings(custom, storage);
    expect(loadKeyBindings(storage).forward).toBe('ArrowUp');
  });

  it('falls back to defaults for a corrupted storage value instead of throwing', () => {
    const storage = fakeStorage();
    storage.setItem('robot-control-panel:key-bindings:v1', '{not valid json');
    expect(loadKeyBindings(storage)).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('fills in missing actions from defaults when saved data is partial', () => {
    const storage = fakeStorage();
    storage.setItem('robot-control-panel:key-bindings:v1', JSON.stringify({ forward: 'ArrowUp' }));
    const result = loadKeyBindings(storage);
    expect(result.forward).toBe('ArrowUp');
    expect(result.backward).toBe(DEFAULT_KEY_BINDINGS.backward);
  });
});

describe('rebind', () => {
  it('assigns the new code to the given action', () => {
    const result = rebind(DEFAULT_KEY_BINDINGS, 'forward', 'ArrowUp');
    expect(result.forward).toBe('ArrowUp');
  });

  it('clears the code from any other action that previously held it', () => {
    const result = rebind(DEFAULT_KEY_BINDINGS, 'backward', DEFAULT_KEY_BINDINGS.forward);
    expect(result.backward).toBe(DEFAULT_KEY_BINDINGS.forward);
    expect(result.forward).toBe(''); // no longer bound to anything
  });

  it('does not mutate the input bindings object', () => {
    const original = { ...DEFAULT_KEY_BINDINGS };
    rebind(DEFAULT_KEY_BINDINGS, 'forward', 'ArrowUp');
    expect(DEFAULT_KEY_BINDINGS).toEqual(original);
  });
});

describe('computeControlVector', () => {
  it('returns zero throttle/steer when no keys are held', () => {
    expect(computeControlVector(DEFAULT_KEY_BINDINGS, new Set())).toEqual({ throttle: 0, steer: 0 });
  });

  it('combines forward and right into a positive throttle and steer', () => {
    const held = new Set([DEFAULT_KEY_BINDINGS.forward, DEFAULT_KEY_BINDINGS.right]);
    expect(computeControlVector(DEFAULT_KEY_BINDINGS, held)).toEqual({ throttle: 1, steer: 1 });
  });

  it('cancels out opposite keys held simultaneously', () => {
    const held = new Set([DEFAULT_KEY_BINDINGS.forward, DEFAULT_KEY_BINDINGS.backward]);
    expect(computeControlVector(DEFAULT_KEY_BINDINGS, held).throttle).toBe(0);
  });

  it('the stop key overrides every other held key', () => {
    const held = new Set([DEFAULT_KEY_BINDINGS.forward, DEFAULT_KEY_BINDINGS.right, DEFAULT_KEY_BINDINGS.stop]);
    expect(computeControlVector(DEFAULT_KEY_BINDINGS, held)).toEqual({ throttle: 0, steer: 0 });
  });

  it('respects a live rebinding rather than the original default key', () => {
    const rebound = rebind(DEFAULT_KEY_BINDINGS, 'forward', 'ArrowUp');
    const held = new Set(['ArrowUp']);
    expect(computeControlVector(rebound, held).throttle).toBe(1);
    // the old key no longer does anything
    const heldOldKey = new Set([DEFAULT_KEY_BINDINGS.forward]);
    expect(computeControlVector(rebound, heldOldKey).throttle).toBe(0);
  });
});
