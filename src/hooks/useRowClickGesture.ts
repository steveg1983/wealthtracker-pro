import { useCallback, useMemo, useRef } from 'react';
import type React from 'react';

/**
 * Telling a CLICK on a row apart from the tail of a text-SELECTION drag.
 *
 * ─ THE BUG THIS EXISTS FOR ─────────────────────────────────────────────────
 * The owner, tidying imported descriptions in the register: a row is already
 * the editor, so its Description cell is a text box. He presses the mouse
 * inside that box, drags to select the words he wants to replace, and lets go
 * a few pixels outside the box — still inside the same row. Nothing was
 * clicked, as far as he is concerned.
 *
 * The browser disagrees. `click` is dispatched on the nearest COMMON ANCESTOR
 * of where the button went down and where it came up (UI Events, "click"), and
 * the common ancestor of "in the description box" and "on the row" is THE ROW.
 * So the row's own onClick fires with the row as its target, the register reads
 * that as the "click the open row again → give me the full editor" idiom, and
 * the Edit Transaction modal lands on top of the words he was selecting.
 *
 * The row editor's cells already stop clicks of their own (see
 * QuickEditCellShell): those are clicks whose TARGET is inside the cell, and a
 * synthesised ancestor click never has that target. Stopping propagation can
 * only speak for gestures that begin AND end in the same place; this hook is
 * for the ones that do not.
 *
 * ─ WHY THE MOUSEDOWN ORIGIN, AND NOT THE SELECTION ─────────────────────────
 * The obvious test — "is there a non-collapsed selection?" — cannot see this
 * case at all. Text selected inside an <input> or <textarea> lives in the
 * control's own value, not in the document, and Chrome and Safari report
 * `window.getSelection()` as collapsed for it (Firefox is the odd one out).
 * The gesture is also worth ignoring when it selected NOTHING — a press,
 * a wobble and a release outside the box is still not a click on the row.
 *
 * Where the gesture BEGAN answers both, and it is the one fact the browser
 * throws away when it picks the ancestor. So the row notes it on mousedown and
 * spends it on the click that follows.
 *
 * mousedown, not pointerdown: every gesture that ends in a `click` is preceded
 * by a `mousedown` — touch and pen included, via the compatibility mouse events
 * browsers fire after a tap — so mousedown catches strictly more without
 * needing PointerEvent, which jsdom does not implement.
 *
 * ─ WHAT ABOUT A DRAG THAT STARTS ON THE ROW'S OWN TEXT? ────────────────────
 * It cannot happen where this is used. A row that takes a click is drawn
 * `select-none` (see VirtualizedTable's clickableClass), so its rendered text
 * is not selectable and no document selection can intersect it; the editable
 * controls inside it stay selectable regardless, because the used value of
 * `user-select` on an editable element is `contain` however the ancestors are
 * drawn (CSS UI 4). A `window.getSelection()` arm here would therefore be code
 * that can never be true. If a clickable row is ever made selectable, this is
 * the place to add it — and a test with it.
 */

/**
 * The controls a text-selection drag can start in.
 *
 * `[contenteditable]` is matched only for the values that actually turn editing
 * ON: the attribute is present-and-"false" on anything deliberately made
 * read-only, and matching that would be the opposite of what it says.
 *
 * `[role="combobox"]` is here because ours are DIVs, not inputs — the category
 * and account pickers put the role on a wrapper that holds the search box (see
 * CategorySelector, AccountSelector) — so the element the press lands on is not
 * always one the tag names below can see.
 */
const EDITING_CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="combobox"]',
].join(',');

/**
 * A cell the row's detail has taken over — marked by VirtualizedTable, which is
 * the only thing that knows which cells those are.
 *
 * The cell counts as well as the control inside it because that is the rule the
 * register already keeps for ordinary clicks: the editor's cell shell covers
 * the WHOLE cell so that "aiming at the description box and missing it by three
 * pixels types rather than opening the full editor". A drag is owed the same
 * answer as a click from the same three pixels.
 */
export const ROW_EDITOR_CELL_ATTRIBUTE = 'data-row-editor-cell';

/**
 * Did this gesture begin somewhere that makes it typing or selecting rather
 * than a click on the row?
 *
 * Bounded by the row (`boundary`): only the row's own subtree can speak for the
 * row, and an editable ancestor somewhere above the table says nothing about
 * this row.
 *
 * Element rather than HTMLElement: a press can land on an <svg> inside a
 * control, which is an Element and not an HTMLElement.
 */
export function beganInEditingControl(target: EventTarget | null, boundary: Element | null): boolean {
  if (!(target instanceof Element) || !boundary) return false;
  const match = target.closest(`${EDITING_CONTROL_SELECTOR},[${ROW_EDITOR_CELL_ATTRIBUTE}]`);
  return match !== null && boundary.contains(match);
}

export interface RowClickGesture {
  /**
   * Spread onto the clickable row, alongside its own onClick.
   *
   * Both are CAPTURE handlers so they are heard wherever inside the row the
   * gesture happens, including in the parts that stop their own events on the
   * way back up.
   */
  rowGestureProps: {
    onMouseDownCapture: React.MouseEventHandler<Element>;
    onClickCapture: React.MouseEventHandler<Element>;
  };
  /**
   * Call FIRST in the row's onClick: true when this click is the tail of a
   * gesture that began in an editing control, and so must do nothing at all.
   *
   * Doing nothing is what keeps the selection: any state change here would
   * re-render the row and move focus, which collapses what was selected.
   */
  isSelectionTail: () => boolean;
}

/**
 * One gesture is in flight at a time, so one pair of refs serves every row of
 * the table.
 *
 * The origin is read at MOUSEDOWN rather than kept as a node and asked later:
 * by the time the click arrives, a re-render may have detached the element the
 * press landed on, and `closest` on a detached node answers for nothing.
 *
 * Each click then CONSUMES the origin (in the capture handler, which every
 * click inside the row reaches — even ones a cell stops before they bubble), so
 * no press can ever be spent twice or answer for a later click. A click with no
 * mousedown before it — a keyboard activation, or one dispatched by code — has
 * no origin, and is a genuine click.
 */
export function useRowClickGesture(): RowClickGesture {
  const gestureBeganInControlRef = useRef(false);
  const clickBeganInControlRef = useRef(false);

  const onMouseDownCapture = useCallback((event: React.MouseEvent<Element>): void => {
    gestureBeganInControlRef.current = beganInEditingControl(event.target, event.currentTarget);
  }, []);

  const onClickCapture = useCallback((): void => {
    clickBeganInControlRef.current = gestureBeganInControlRef.current;
    gestureBeganInControlRef.current = false;
  }, []);

  const isSelectionTail = useCallback((): boolean => clickBeganInControlRef.current, []);

  return useMemo(
    () => ({ rowGestureProps: { onMouseDownCapture, onClickCapture }, isSelectionTail }),
    [onMouseDownCapture, onClickCapture, isSelectionTail]
  );
}
