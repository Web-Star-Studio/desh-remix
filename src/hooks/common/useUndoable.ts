import { useState, useRef, useCallback } from "react";

const MAX_HISTORY = 500;
const GROUP_MS = 500;

export function useUndoable(initial: string) {
  const [value, setValue] = useState(initial);
  const history = useRef<string[]>([initial]);
  const pointer = useRef(0);
  const lastSetTime = useRef(0);

  const set = useCallback((v: string) => {
    const now = Date.now();
    const elapsed = now - lastSetTime.current;
    lastSetTime.current = now;

    if (elapsed < GROUP_MS && pointer.current > 0) {
      history.current[pointer.current] = v;
    } else {
      const next = history.current.slice(0, pointer.current + 1);
      next.push(v);
      if (next.length > MAX_HISTORY) next.shift();
      history.current = next;
      pointer.current = next.length - 1;
    }
    setValue(v);
  }, []);

  const undo = useCallback(() => {
    if (pointer.current <= 0) return;
    pointer.current--;
    setValue(history.current[pointer.current]);
  }, []);

  const redo = useCallback(() => {
    if (pointer.current >= history.current.length - 1) return;
    pointer.current++;
    setValue(history.current[pointer.current]);
  }, []);

  const reset = useCallback((v: string) => {
    history.current = [v];
    pointer.current = 0;
    setValue(v);
  }, []);

  const canUndo = pointer.current > 0;
  const canRedo = pointer.current < history.current.length - 1;

  return { value, set, undo, redo, reset, canUndo, canRedo };
}
