import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

/**
 * What counts as "clicked outside" a dialog — one answer, for every dialog.
 *
 * ─ THE BUG ─────────────────────────────────────────────────────────────────
 *
 * Eight surfaces each wrote this, and each wrote it the same way:
 *
 *   onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
 *
 * which reads as "the click was on the backdrop, not the panel" and is not
 * what it says. A browser attributes a `click` to the nearest common ANCESTOR
 * of where the button went down and where it came up. So selecting text in a
 * field and releasing the mouse a few pixels past the panel's edge produces a
 * click on the backdrop — and the dialog threw itself away mid-edit, taking
 * whatever had been typed with it.
 *
 * The owner found it selecting an institution name in Account Settings, then
 * asked the right question: "I also dont know if the same problem is anywhere
 * else?" It was, in all eight.
 *
 * ─ THE ANSWER ──────────────────────────────────────────────────────────────
 *
 * A dismissal needs the press AND the release on the backdrop. Recording the
 * pointer-down is the whole fix, and putting it here means the next dialog
 * inherits it instead of re-deriving it.
 *
 * ─ WHAT THIS IS NOT FOR ────────────────────────────────────────────────────
 *
 * The dropdowns and popovers that dismiss via a document-level `mousedown`
 * listener are a different pattern and are already correct: they close on the
 * PRESS, so a drag that began inside them never reaches the listener at all.
 * They need nothing from this hook.
 */
export interface BackdropDismissHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
}

export function useBackdropDismiss(onDismiss: () => void): BackdropDismissHandlers {
  /**
   * Whether the press that is about to become a click began on the backdrop.
   *
   * A ref, not state: written during a pointer event, read in the click that
   * follows, and drawn by nothing — as state it would re-render the whole
   * dialog on every press to store a boolean no one displays.
   */
  const pressedOnBackdrop = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }, []);

  const onClick = useCallback((event: ReactMouseEvent<HTMLElement>): void => {
    const outside = event.target === event.currentTarget && pressedOnBackdrop.current;
    // Cleared either way. Left set, one drag-out would arm the dialog against
    // every dismissal after it — a fix that quietly removes the feature.
    pressedOnBackdrop.current = false;
    if (outside) onDismiss();
  }, [onDismiss]);

  return { onPointerDown, onClick };
}
