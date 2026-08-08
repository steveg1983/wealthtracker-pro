import React from 'react';
import { ArchiveIcon, CheckIcon, TrashIcon, XIcon } from './icons';

interface RegisterSelectionBarProps {
  /** How many rows the selection covers. Only shown for two or more. */
  count: number;
  /** How many of them are not yet reconciled — what Reconcile would change. */
  unreconciledCount: number;
  /** How many are not yet archived — what Archive would change. */
  archivableCount: number;
  /** True while one of the actions is running. */
  busy: boolean;
  onReconcile: () => void;
  onUnreconcile: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * What you can do with several selected rows, and what each would change.
 *
 * It takes the dock's place while a multi-row selection is up, because the
 * quick editor below the register edits ONE transaction and showing it beside
 * a selection of nine would be a lie about what Save was going to touch.
 *
 * Every button says how many rows it would actually affect rather than how
 * many are selected: "Reconcile 4" on a selection of nine means five are
 * reconciled already, which is worth knowing before pressing it. A button
 * with nothing to do is disabled and says why.
 *
 * The four actions are deliberately all there is. Anything that rewrites what
 * a transaction MEANS — its category, its amount, its payee — stays a
 * one-row-at-a-time job in the editor, where the whole row is on screen.
 */
export default function RegisterSelectionBar({
  count,
  unreconciledCount,
  archivableCount,
  busy,
  onReconcile,
  onUnreconcile,
  onArchive,
  onDelete,
  onClear,
}: RegisterSelectionBarProps): React.JSX.Element {
  const reconciledCount = count - unreconciledCount;
  const buttonClass =
    'inline-flex items-center gap-1.5 px-3 h-[38px] text-sm font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      data-register-selection-bar
      className="mt-3 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center gap-3"
    >
      {/* The spoken version of this count lives in a live region that is
          always in the page (see the register) — a region that appears
          already holding its message is announced unreliably, if at all. */}
      <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
        {count} transactions selected
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReconcile}
          disabled={busy || unreconciledCount === 0}
          title={
            unreconciledCount === 0
              ? 'Every selected transaction is reconciled already'
              : 'Tick the R column on these transactions'
          }
          className={`${buttonClass} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700`}
        >
          <CheckIcon size={15} />
          Reconcile {unreconciledCount > 0 ? unreconciledCount : ''}
        </button>

        <button
          type="button"
          onClick={onUnreconcile}
          disabled={busy || reconciledCount === 0}
          title={
            reconciledCount === 0
              ? 'None of the selected transactions is reconciled'
              : 'Clear the R column on these transactions'
          }
          className={`${buttonClass} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700`}
        >
          <XIcon size={15} />
          Un-reconcile {reconciledCount > 0 ? reconciledCount : ''}
        </button>

        <button
          type="button"
          onClick={onArchive}
          disabled={busy || archivableCount === 0}
          title={
            archivableCount === 0
              ? 'Every selected transaction is archived already'
              : 'Hide these from the live list. Nothing is deleted, and every balance and report is unchanged.'
          }
          className={`${buttonClass} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700`}
        >
          <ArchiveIcon size={15} />
          Archive {archivableCount > 0 ? archivableCount : ''}
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title="Delete these transactions — you will be told what each one leaves behind first"
          className={`${buttonClass} border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30`}
        >
          <TrashIcon size={15} />
          Delete
        </button>
      </div>

      <button
        type="button"
        onClick={onClear}
        disabled={busy}
        className="ml-auto text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 disabled:opacity-40"
      >
        Clear selection
      </button>
    </div>
  );
}
