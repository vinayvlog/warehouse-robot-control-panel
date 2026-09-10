/**
 * Each control action maps to exactly one keyboard code (e.g. "KeyW",
 * "ArrowUp"). Bindings live in component state + localStorage -- never in a
 * source-controlled config file -- so an operator can rebind a key
 * mid-session and the change takes effect on the very next keypress.
 */
export type ControlAction = 'forward' | 'backward' | 'left' | 'right' | 'stop';

export type KeyBindings = Record<ControlAction, string>;

export const CONTROL_ACTIONS: ControlAction[] = ['forward', 'backward', 'left', 'right', 'stop'];

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  stop: 'Space',
};

const STORAGE_KEY = 'robot-control-panel:key-bindings:v1';

export const ACTION_LABELS: Record<ControlAction, string> = {
  forward: 'Drive forward',
  backward: 'Drive backward',
  left: 'Turn left',
  right: 'Turn right',
  stop: 'Emergency stop',
};

export function loadKeyBindings(storage: Pick<Storage, 'getItem'> = window.localStorage): KeyBindings {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEY_BINDINGS };
    const parsed = JSON.parse(raw) as Partial<KeyBindings>;
    const merged = { ...DEFAULT_KEY_BINDINGS };
    for (const action of CONTROL_ACTIONS) {
      if (typeof parsed[action] === 'string' && parsed[action]!.length > 0) {
        merged[action] = parsed[action]!;
      }
    }
    return merged;
  } catch {
    return { ...DEFAULT_KEY_BINDINGS };
  }
}

export function saveKeyBindings(bindings: KeyBindings, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

/**
 * Rebinds `action` to `code`, un-assigning `code` from whatever action
 * previously held it so two actions never silently share one key.
 */
export function rebind(bindings: KeyBindings, action: ControlAction, code: string): KeyBindings {
  const next = { ...bindings };
  for (const other of CONTROL_ACTIONS) {
    if (other !== action && next[other] === code) {
      next[other] = '';
    }
  }
  next[action] = code;
  return next;
}

export interface ControlVector {
  throttle: number;
  steer: number;
}

/** Translates the set of currently-held key codes into a throttle/steer command. */
export function computeControlVector(bindings: KeyBindings, heldCodes: ReadonlySet<string>): ControlVector {
  if (heldCodes.has(bindings.stop)) {
    return { throttle: 0, steer: 0 };
  }
  let throttle = 0;
  let steer = 0;
  if (heldCodes.has(bindings.forward)) throttle += 1;
  if (heldCodes.has(bindings.backward)) throttle -= 1;
  if (heldCodes.has(bindings.right)) steer += 1;
  if (heldCodes.has(bindings.left)) steer -= 1;
  return { throttle: Math.max(-1, Math.min(1, throttle)), steer: Math.max(-1, Math.min(1, steer)) };
}
