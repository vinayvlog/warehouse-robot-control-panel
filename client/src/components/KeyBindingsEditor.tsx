import { ACTION_LABELS, CONTROL_ACTIONS, KeyBindings } from '../lib/keyBindings';
import { ControlAction } from '../lib/keyBindings';

interface Props {
  bindings: KeyBindings;
  capturingAction: ControlAction | null;
  onBeginCapture: (action: ControlAction) => void;
  onCancelCapture: () => void;
}

export function KeyBindingsEditor({ bindings, capturingAction, onBeginCapture, onCancelCapture }: Props) {
  return (
    <div className="key-bindings">
      <h2>Controls</h2>
      <p className="key-bindings__hint">Click a binding, then press any key to reassign it. Esc cancels.</p>
      <ul className="key-bindings__list">
        {CONTROL_ACTIONS.map((action) => {
          const isCapturing = capturingAction === action;
          return (
            <li key={action} className="key-bindings__row">
              <span>{ACTION_LABELS[action]}</span>
              <button
                type="button"
                className={isCapturing ? 'key-chip key-chip--capturing' : 'key-chip'}
                onClick={() => (isCapturing ? onCancelCapture() : onBeginCapture(action))}
                aria-label={`Rebind ${ACTION_LABELS[action]}`}
              >
                {isCapturing ? 'Press a key…' : bindings[action] || '(unbound)'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
