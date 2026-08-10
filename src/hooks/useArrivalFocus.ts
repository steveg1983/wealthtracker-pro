import { useCallback, useEffect, useRef } from 'react';

/**
 * Landing on the ONE thing a drill-down pointed at.
 *
 * The register already does this for a `?txn=` link — it selects the row,
 * centres it and highlights it — and a chart click that opens a report should
 * feel like the same app, not like a page that happens to contain the answer
 * somewhere below the fold. These two hooks are that behaviour for the report
 * tables and for the reports that answer a point with a dialog instead.
 *
 * Both are written to survive arriving EARLY, which is the normal case here: a
 * report is code-split and its data recomputes when the arrival period lands, so
 * the row being aimed at frequently does not exist during the first render.
 * Neither hook gives up — the row scrolls itself in when it appears, and the
 * action retries whenever its inputs change until it can be carried out.
 */

/**
 * The look of the row a drill-down landed on. A tint plus an inset ring, so it
 * reads as "this one" against both table stripes and dark mode, and is not the
 * hover colour of the row next to it.
 */
export const ARRIVAL_ROW_CLASS =
  'bg-blue-50 dark:bg-blue-900/25 ring-1 ring-inset ring-blue-300 dark:ring-blue-700';

export interface ArrivalRowFocus {
  /** True for the row the drill-down pointed at, if any. */
  isFocused: (key: string) => boolean;
  /**
   * Put this on that row and nothing else: it scrolls itself into the middle
   * of the view when it appears. Once per focus token — a later re-render, or
   * the user scrolling away deliberately, must not drag the page back.
   */
  focusRef: (node: HTMLElement | null) => void;
}

/** Highlight and scroll to the row whose key matches `focus`. */
export function useArrivalRowFocus(focus: string | null | undefined): ArrivalRowFocus {
  const scrolledFor = useRef<string | null>(null);

  const focusRef = useCallback((node: HTMLElement | null): void => {
    if (node === null || focus === null || focus === undefined) return;
    if (scrolledFor.current === focus) return;
    scrolledFor.current = focus;
    // Optional call: jsdom has no scrollIntoView, and a test asserting the
    // highlight is not a reason to make the app defensive about it elsewhere.
    node.scrollIntoView?.({ block: 'center' });
  }, [focus]);

  const isFocused = useCallback(
    (key: string): boolean => focus !== null && focus !== undefined && key === focus,
    [focus]
  );

  return { isFocused, focusRef };
}

/**
 * Carry out the arrival's request once, as soon as it CAN be carried out.
 *
 * `act` returns true when it managed it and false when the thing being pointed
 * at is not there (yet, or at all). It must be a stable callback that changes
 * identity with the data it reads, which is what wakes this to try again — the
 * same shape as the register's pending deep link.
 *
 * A request that never resolves — a month outside the period, a category that
 * no longer exists — simply never fires. Nothing is shown about it: the report
 * itself is still the answer to what was clicked, and an error about a missing
 * row would be about the app rather than about the money.
 */
export function useArrivalAction(
  focus: string | null | undefined,
  act: (token: string) => boolean
): void {
  const doneFor = useRef<string | null>(null);

  useEffect((): void => {
    if (focus === null || focus === undefined) return;
    if (doneFor.current === focus) return;
    if (act(focus)) doneFor.current = focus;
  }, [focus, act]);
}
