import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface AddWithoutCategoryConfirmProps {
  /** The payee the row is about to be filed under — named, so nobody adds blind. */
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "You haven't chosen a category — add anyway?"
 *
 * ── WHY A QUESTION AND NOT A BLOCK ──────────────────────────────────────────
 * An uncategorised transaction is a legitimate thing to enter: the balance is
 * right the moment it is in, and the filing can wait for the review band. What
 * is NOT legitimate is entering one by accident, which is exactly what a
 * one-keystroke Enter makes easy. So the row still goes in — the user just has
 * to mean it.
 *
 * ── WHY THIS AND NOT window.confirm ─────────────────────────────────────────
 * The register's own idiom, matching DeleteTransactionConfirm line for line: a
 * portaled `alertdialog`, focus trapped between the two buttons, Escape
 * cancels, and focus RETURNED on the way out to whatever opened it — the field
 * the user pressed Enter in, so the keyboard run through the add bar carries on
 * where it left off. A native confirm cannot be styled, cannot be tested, and
 * drops focus on the body when it closes.
 *
 * ── WHY CONTINUE HAS THE FOCUS, AND WHY THAT IS SAFE ────────────────────────
 * The flow this dialog interrupts is Enter, so Enter has to be able to finish
 * it or the guard turns a one-key add into a mouse errand. The Enter keydown
 * that OPENED the dialog cannot activate the button: it was dispatched to the
 * add bar and had finished before this mounted. A key HELD down is the one real
 * risk — it repeats — so a repeating keystroke is refused here, and only a
 * deliberate second press answers the question.
 */
export default function AddWithoutCategoryConfirm({
  description,
  onConfirm,
  onCancel,
}: AddWithoutCategoryConfirmProps): React.JSX.Element {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const bodyId = `${instanceId}-body`;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmRef.current?.focus();
    return () => {
      // preventScroll: the opener is a field in a dock pinned to the foot of a
      // full-height register, and hauling it into view would move the list.
      opener?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.repeat) {
      // A key held down from the add bar must not answer the question it asked.
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // The register listens for keys too; this one is answered here.
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Tab') {
      // Two buttons, so forwards and backwards are the same move — and neither
      // leaves the dialog.
      e.preventDefault();
      const next =
        document.activeElement === confirmRef.current ? cancelRef.current : confirmRef.current;
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
          No category chosen
        </h3>
        <p id={bodyId} className="text-gray-600 dark:text-gray-400 mb-4">
          You haven&rsquo;t chosen a category for &ldquo;{description}&rdquo; — add anyway? It will
          sit in the review band until you file it.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
