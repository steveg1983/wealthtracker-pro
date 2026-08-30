import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BulkDeletePlan } from '../utils/registerBulkDelete';

interface BulkDeleteTransactionsConfirmProps {
  /** What the delete would actually do — see planBulkDelete. */
  plan: BulkDeletePlan;
  onConfirm: () => void;
  onCancel: () => void;
  /** True while the deletes are running, so nothing can be asked for twice. */
  busy?: boolean;
}

/**
 * The confirmation for deleting several transactions at once.
 *
 * It exists because a bulk delete must not be quieter than the same deletes
 * done one at a time. So it says three things, in this order:
 *
 *   1. how many rows are going;
 *   2. every row that would leave HALF a transfer behind, by name, with the
 *      account that keeps the stranded half — the identical sentence the
 *      single-row confirmation shows, repeated per row rather than summarised,
 *      because "3 transfers affected" is not consent;
 *   3. every row it is REFUSING to touch, by name — a split parent or the
 *      other side of a split line. Those stay exactly where they are, and
 *      saying so is the difference between a refusal and a silent omission.
 *
 * ─ Why Cancel has the focus, when the single-row dialog focuses Delete ────
 * The single-row confirmation is the last step of a keyboard loop — arrow,
 * Delete, Enter — over one named row, and focusing Delete is what makes that
 * loop work. This dialog has a list in it that has to be READ: several rows,
 * possibly several stranded halves in accounts nobody is looking at. A bulk
 * delete one Enter away from a reflex would be a different, worse thing. So
 * the safe button takes the focus, and the destructive one must be reached.
 *
 * alertdialog, like its single-row sibling: this interrupts to ask about
 * something destructive, and the role makes a screen reader read the
 * consequence out on arrival rather than waiting to be explored.
 */
export default function BulkDeleteTransactionsConfirm({
  plan,
  onConfirm,
  onCancel,
  busy = false,
}: BulkDeleteTransactionsConfirmProps): React.JSX.Element {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const bodyId = `${instanceId}-body`;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      // preventScroll: the opener is a full-height register, and hauling it
      // back into view would undo its own scroll position.
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
      // Two buttons, so forwards and backwards are the same move — and
      // neither leaves the dialog.
      e.preventDefault();
      const next = document.activeElement === confirmRef.current ? cancelRef.current : confirmRef.current;
      next?.focus();
    }
  };

  const count = plan.deleting.length;
  const nothingToDelete = count === 0;

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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] overflow-y-auto"
      >
        <h3 id={titleId} className="text-lg font-semibold mb-4 dark:text-white">
          {nothingToDelete
            ? 'Nothing here can be deleted together'
            : count === 1
              ? 'Delete 1 transaction?'
              : `Delete ${count} transactions?`}
        </h3>

        <div id={bodyId}>
          {nothingToDelete ? (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Every row you selected is one this cannot safely remove in a batch. They are
              listed below, and each can still be deleted on its own.
            </p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                This cannot be undone.
              </p>
              <ul className="mb-4 max-h-40 overflow-y-auto text-sm text-gray-700 dark:text-gray-300 space-y-1 pl-4 list-disc marker:text-gray-400">
                {plan.deleting.map(transaction => (
                  <li key={transaction.id} className="break-words">
                    {transaction.description}
                  </li>
                ))}
              </ul>
            </>
          )}

          {plan.stranding.length > 0 && (
            <div className="mb-4 text-sm text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 space-y-2">
              {/* The box says what it is before it says which rows. Without a
                  heading the warning reads as a remark about the last row in
                  the list above it, rather than about the accounts nobody is
                  looking at. */}
              <p className="font-semibold">
                {plan.stranding.length === 1
                  ? 'One of these leaves something behind in another account:'
                  : `${plan.stranding.length} of these leave something behind in other accounts:`}
              </p>
              {plan.stranding.map(({ transaction, message }) => (
                <p key={transaction.id}>
                  <span className="font-semibold">&ldquo;{transaction.description}&rdquo;</span>{' '}
                  {message}
                </p>
              ))}
            </div>
          )}

          {plan.excluded.length > 0 && (
            /* Amber above is a real warning — something is left stranded.
               This box says the opposite: rows are being PROTECTED. A
               protection is not a warning and takes no colour of its own
               (stock-blue ruling, 28 Aug 2026). */
            <div className="mb-4 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
              <p className="font-semibold">
                {plan.excluded.length === 1
                  ? 'One row is being left alone:'
                  : `${plan.excluded.length} rows are being left alone:`}
              </p>
              {plan.excluded.map(({ transaction, reason }) => (
                <p key={transaction.id}>
                  <span className="font-semibold">&ldquo;{transaction.description}&rdquo;</span>{' '}
                  {reason}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {nothingToDelete ? 'Close' : 'Cancel'}
          </button>
          {!nothingToDelete && (
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Deleting…' : count === 1 ? 'Delete 1 transaction' : `Delete ${count} transactions`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
