import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DeleteProfileConfirmProps {
  /** The profile about to go, named — nobody should delete blind. */
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Delete this import profile?"
 *
 * ── WHY THE QUESTION IS SMALL, AND SAYS SO ──────────────────────────────────
 * Deleting a profile costs nothing but the column mapping it remembered: no
 * transaction moves, no balance changes, and the same file can be mapped again
 * by hand or by the same bank template. The dialog says exactly that, because a
 * confirm that will not tell you what you are risking makes every deletion feel
 * like the dangerous kind.
 *
 * ── WHY IT EXISTS AT ALL ────────────────────────────────────────────────────
 * There was no way to remove a saved profile. They could only accumulate, so a
 * mis-saved one sat in the dropdown for good.
 *
 * The register's confirm idiom, not window.confirm: portaled `alertdialog`,
 * focus trapped between the two buttons, Escape cancels, focus returned to the
 * control that opened it. CANCEL holds the focus here, unlike the add-anyway
 * dialog — the safe answer is the default when the question is a deletion.
 */
export default function DeleteProfileConfirm({
  profileName,
  onConfirm,
  onCancel
}: DeleteProfileConfirmProps): React.JSX.Element {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const bodyId = `${instanceId}-body`;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      opener?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
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
          Delete &ldquo;{profileName}&rdquo;?
        </h3>
        <p id={bodyId} className="text-gray-600 dark:text-gray-400 mb-4">
          This forgets the column mapping saved under that name. No transactions are touched and
          nothing already imported changes — you would just have to map this bank&apos;s columns
          again next time.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Keep it
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete profile
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
