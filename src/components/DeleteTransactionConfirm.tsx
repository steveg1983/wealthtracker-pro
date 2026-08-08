import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DeleteStranding } from '../utils/transferOtherSide';
import type { Transaction } from '../types';

interface DeleteTransactionConfirmProps {
  /** The row about to go. Named in the question, so nobody deletes blind. */
  transaction: Transaction;
  /**
   * What deleting it would strand in another account — null for an ordinary
   * row, and then nothing extra is rendered. See describeDeleteStranding: the
   * counterpart of a linked transfer survives the delete, still moving its own
   * account's balance, with its link silently nulled.
   */
  stranding: DeleteStranding | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The register's delete confirmation, built to be answered from the keyboard.
 *
 * Delete is FOCUSED on open, so the register's power-user loop — arrow to the
 * row, Delete, Enter — completes without the hand leaving the keyboard. That is
 * the Money/Quicken register idiom, and it is safe here for a specific reason:
 * confirmation is the browser's own activation of a focused button, so it takes
 * a keypress delivered to THIS button. The Delete keypress that opened the
 * dialog has already been dispatched and cannot activate it, and holding Delete
 * down only repeats a key the button ignores.
 *
 * alertdialog, not dialog: this interrupts to ask about something destructive,
 * and the role makes a screen reader read the consequence out on arrival rather
 * than waiting to be explored.
 *
 * Focus is trapped between the two buttons while it is open and RETURNED to
 * whatever opened it on the way out — the register grid, which is still
 * highlighting a row and still listening for arrows. A confirmation that drops
 * focus on the body dead-ends the keyboard flow after every delete.
 */
export default function DeleteTransactionConfirm({
  transaction,
  stranding,
  onConfirm,
  onCancel,
}: DeleteTransactionConfirmProps): React.JSX.Element {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const bodyId = `${instanceId}-body`;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmRef.current?.focus();
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
      // Two buttons, so forwards and backwards are the same move — and neither
      // leaves the dialog.
      e.preventDefault();
      const next = document.activeElement === confirmRef.current ? cancelRef.current : confirmRef.current;
      next?.focus();
    }
  };

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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
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
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
