import { useEffect, useState } from 'react';

/** DESIGN_PASS §4: "Under 200ms: show nothing." */
export const LOADING_REVEAL_DELAY_MS = 200;

/**
 * True only once `active` has been true for `delayMs` without interruption —
 * the rule that keeps a fast load SILENT.
 *
 * A skeleton that appears for 80ms and vanishes is a flash of grey bars where
 * the figures were about to be, and it makes a fast app look like a slow one.
 * So the placeholder is not "what we show while loading", it is "what we show
 * once loading has gone on long enough to need explaining".
 *
 * Falling back to false is IMMEDIATE and unconditional: the moment the data
 * arrives the placeholder goes, with no timer left holding it on screen.
 */
export function useDelayedFlag(active: boolean, delayMs: number = LOADING_REVEAL_DELAY_MS): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return active && elapsed;
}
