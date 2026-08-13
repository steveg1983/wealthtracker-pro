import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DeleteStranding } from '../utils/transferOtherSide';
import type { Transaction } from '../types';

interface DeleteTransactionConfirmProps {
  /** The row about to go. Named in the question, so nobody deletes blind. */
  transaction: Transaction;
  /**
   * What deleting it would leave in another account — null for an ordinary row,
   * and then nothing extra is rendered. See describeDeleteStranding: the
   * counterpart of a linked transfer survives the delete, released into a plain
   * uncategorised row in the account it sits in.
   */
  stranding: DeleteStranding | null;
  /**
   * Remove BOTH halves of the transfer. Given only when there is a second half
   * that can go with this one (`stranding.deletableOtherSide`); the third button
   * appears exactly when this prop and that row are both present, so the offer
   * and the thing it would do can never disagree.
   */
  onConfirmBothSides?: () => void;
  /** Remove this row only. The other half, if any, is released. */
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The register's delete confirmation, built to be answered from the keyboard.
 *
 * ─ TWO ACTIONS, OR THREE ───────────────────────────────────────────────────
 * An ordinary row has one destructive answer and gets the pair of buttons it
 * always had: Cancel · Delete.
 *
 * One half of a LINKED transfer has two, and hiding the second one behind a
 * warning was the bug this dialog carried: it named the consequence of deleting
 * a leg and then offered no way to do the thing the user almost certainly meant.
 * Deleting a transfer, in Microsoft Money and in every ledger since, deletes the
 * MOVEMENT — both rows. So the linked case offers:
 *
 *   Cancel · Delete this side only · Delete both sides
 *
 * "Delete both sides" is the PRIMARY destructive action: rightmost on a wide
 * screen and topmost on a narrow one, in the same solid red the single Delete
 * has always worn, and holding the focus on open. "Delete this side only" is a
 * real answer, not a footnote — a user really may want to keep the other row
 * (an imported one, say) — so it is a full button rather than a link, but it is
 * outlined rather than filled, because it is the narrower of the two.
 *
 * ─ WHY THE DESTRUCTIVE BUTTON STILL TAKES THE FOCUS ────────────────────────
 * The register's power-user loop is arrow to the row, Delete, Enter, and it has
 * to complete without the hand leaving the keyboard. That is safe for a specific
 * reason: confirmation is the browser's own activation of a focused button, so
 * it takes a keypress delivered to THIS button. The Delete keypress that opened
 * the dialog has already been dispatched and cannot activate it, and holding
 * Delete down only repeats a key the button ignores. On a transfer that loop now
 * removes both halves, which is what deleting a transfer means; the alertdialog
 * says so before the Enter is pressed.
 *
 * alertdialog, not dialog: this interrupts to ask about something destructive,
 * and the role makes a screen reader read the consequence out on arrival rather
 * than waiting to be explored.
 *
 * Focus is trapped across the buttons while it is open and RETURNED to whatever
 * opened it on the way out — the register grid, which is still highlighting a
 * row and still listening for arrows. A confirmation that drops focus on the
 * body dead-ends the keyboard flow after every delete.
 */
export default function DeleteTransactionConfirm({
  transaction,
  stranding,
  onConfirmBothSides,
  onConfirm,
  onCancel,
}: DeleteTransactionConfirmProps): React.JSX.Element {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const bodyId = `${instanceId}-body`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const oneSideRef = useRef<HTMLButtonElement>(null);
  const bothSidesRef = useRef<HTMLButtonElement>(null);

  const offersPairDelete = Boolean(onConfirmBothSides && stranding?.deletableOtherSide);

  /**
   * Tab order, left to right as rendered on a wide screen. The LAST entry is
   * the primary destructive action and the one focused on open, which keeps a
   * two-button dialog behaving exactly as it did before there was a third.
   */
  const order = useMemo(
    () => (offersPairDelete ? [cancelRef, oneSideRef, bothSidesRef] : [cancelRef, oneSideRef]),
    [offersPairDelete]
  );

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Read through the refs rather than the flag, so this stays a mount-only
    // effect with nothing to re-run on: the pair button exists only when it is
    // offered, and it is the primary action whenever it does.
    (bothSidesRef.current ?? oneSideRef.current)?.focus();
    return () => {
      // preventScroll: the opener is a full-height table, and hauling it back
      // into view would undo the register's own scroll position.
      opener?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // The register is listening for keys too; this one is answered here.
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Tab') {
      // The cycle wraps in both directions, so no Tab of any kind leaves the
      // dialog. With two buttons forwards and backwards coincide, which is why
      // this reads the same as the version that assumed they always would.
      e.preventDefault();
      const current = order.findIndex(ref => ref.current === document.activeElement);
      const step = e.shiftKey ? -1 : 1;
      const next = (current === -1 ? 0 : current + step + order.length) % order.length;
      order[next]?.current?.focus();
    }
  };

  // whitespace-nowrap on all three: a label that breaks mid-phrase reads as two
  // buttons, and "Delete this side only" is exactly the length that invites it.
  // Whole buttons may wrap instead (sm:flex-wrap below); words may not.
  const outlinedButton =
'px-4 py-2 whitespace-nowrap border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700';
  const destructiveButton =
'px-4 py-2 whitespace-nowrap bg-red-600 text-white rounded-lg hover:bg-red-700';
  // Outlined, but in the destructive colour: the narrower of the two deletes is
  // still a delete, and a neutral grey beside Cancel would read as a second way
  // of backing out.
  const narrowerDestructiveButton =
'px-4 py-2 whitespace-nowrap border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20';

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        // Wider only when there are three buttons to fit. The three labels come
        // to roughly 460px of button plus 24px of gaps at the default 16px
        // face; max-w-lg leaves 464px inside its padding, which is a hair too
        // tight to promise, and max-w-xl leaves 528px. A confirmation is a
        // sentence and a choice, so the extra width costs nothing.
        className={`bg-white dark:bg-gray-800 rounded-2xl p-6 w-full shadow-xl ${
          offersPairDelete ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <h3 id={titleId} className="text-lg font-semibold mb-4 dark:text-white">
          Delete Transaction
        </h3>
        <div id={bodyId}>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Are you sure you want to delete &ldquo;{transaction.description}&rdquo;? This cannot be undone.
          </p>
          {stranding && (
            <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              {stranding.message}
            </p>
          )}
        </div>
        {/* Stacked on a phone with the primary on top, in a row on anything
            wider with the primary rightmost — the app's destructive idiom
            either way, and never three labels crushed into 375px.

            sm:flex-wrap is the floor under the width sum above: at a larger
            browser font, or in a language whose labels are longer, whole
            buttons drop to a second line instead of the row overflowing its
            box. Words never break; buttons may. */}
        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 sm:gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={outlinedButton}
          >
            Cancel
          </button>
          <button
            ref={oneSideRef}
            type="button"
            onClick={onConfirm}
            className={offersPairDelete ? narrowerDestructiveButton : destructiveButton}
          >
            {offersPairDelete ? 'Delete this side only' : 'Delete'}
          </button>
          {offersPairDelete && (
            <button
              ref={bothSidesRef}
              type="button"
              onClick={onConfirmBothSides}
              className={destructiveButton}
            >
              Delete both sides
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
