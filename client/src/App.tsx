import { useEffect, useRef } from 'react';

import { ConnectionStatus } from './components/ConnectionStatus';
import { KeyBindingsEditor } from './components/KeyBindingsEditor';
import { RobotCanvas } from './components/RobotCanvas';
import { useKeyBindings } from './hooks/useKeyBindings';
import { useRobotConnection } from './hooks/useRobotConnection';
import { computeControlVector } from './lib/keyBindings';

const WS_URL = import.meta.env.VITE_ROBOT_WS_URL ?? 'ws://localhost:8080';

export default function App() {
  const { bindings, capturingAction, beginCapture, cancelCapture } = useKeyBindings();
  const { state, info, setCommand } = useRobotConnection(WS_URL);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  const capturingRef = useRef(capturingAction);
  capturingRef.current = capturingAction;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (capturingRef.current) return; // the rebind capture handler owns this keystroke
      if (heldKeysRef.current.has(event.code)) return;
      heldKeysRef.current.add(event.code);
      setCommand(computeControlVector(bindingsRef.current, heldKeysRef.current));
    }
    function onKeyUp(event: KeyboardEvent) {
      heldKeysRef.current.delete(event.code);
      setCommand(computeControlVector(bindingsRef.current, heldKeysRef.current));
    }
    // Losing window focus mid-drive (alt-tab, etc.) must not leave a key
    // "stuck" held -- clear everything and command a stop.
    function onBlur() {
      heldKeysRef.current.clear();
      setCommand({ throttle: 0, steer: 0 });
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [setCommand]);

  // Re-derive the command whenever bindings change mid-drive, so rebinding
  // a key that's currently held takes effect immediately.
  useEffect(() => {
    setCommand(computeControlVector(bindings, heldKeysRef.current));
  }, [bindings, setCommand]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Warehouse Robot Control Panel</h1>
        <ConnectionStatus info={info} />
      </header>
      <main className="app__main">
        <RobotCanvas state={state} />
        <KeyBindingsEditor
          bindings={bindings}
          capturingAction={capturingAction}
          onBeginCapture={beginCapture}
          onCancelCapture={cancelCapture}
        />
      </main>
      {info.isStale && (
        <div className="stale-banner" role="alert">
          No telemetry from the robot recently — commands are still being sent, but you may be driving blind.
        </div>
      )}
    </div>
  );
}
