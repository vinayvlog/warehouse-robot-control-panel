import { useCallback, useEffect, useState } from 'react';

import { ControlAction, KeyBindings, loadKeyBindings, rebind, saveKeyBindings } from '../lib/keyBindings';

export function useKeyBindings() {
  const [bindings, setBindings] = useState<KeyBindings>(() => loadKeyBindings());
  const [capturingAction, setCapturingAction] = useState<ControlAction | null>(null);

  useEffect(() => {
    saveKeyBindings(bindings);
  }, [bindings]);

  const beginCapture = useCallback((action: ControlAction) => {
    setCapturingAction(action);
  }, []);

  const cancelCapture = useCallback(() => setCapturingAction(null), []);

  // While capturing, the next keydown anywhere on the page rebinds the
  // action instead of being treated as a drive command. This is what makes
  // rebinding a live, in-session action rather than an edit-a-file step.
  useEffect(() => {
    if (!capturingAction) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.code === 'Escape') {
        setCapturingAction(null);
        return;
      }
      setBindings((prev) => rebind(prev, capturingAction, event.code));
      setCapturingAction(null);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [capturingAction]);

  return { bindings, capturingAction, beginCapture, cancelCapture };
}
