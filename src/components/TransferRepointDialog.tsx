import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { ArrowRightLeftIcon } from './icons';
import type { Transaction, TransferDisplacedDisposition } from '../types';

/**
 * "This transfer's other side may be a real transaction. What should happen to
 * it?"
 *
 * Shown only when a re-point is about to displace a counterpart that could NOT
 * be proved to be scaffolding this app created — see
 * src/utils/transferCounterpartOrigin.ts, which can prove that and nothing
 * else, and therefore asks whenever it cannot.
 *
 * ─ WHY IT NAMES THE CONSEQUENCE, NOT THE MECHANISM ─────────────────────────
 * Every option here changes two accounts, and only one of them is on screen.
 * So each button says what will be true afterwards, in the account it will be
 * true in, and the reason the question is being asked at all is printed above
 * them — because "we cannot tell what this row is" is exactly the information
 * that lets the user answer it, and they are the only one who knows.
 *
 * ─ WHY "MOVE IT ANYWAY" IS OFFERED ─────────────────────────────────────────
 * The detection is one-way: it proves "the app made this" or it says nothing.
 * A counterpart the app made and the user later edited — ticked as reconciled,
 * retyped the description — comes out unprovable, and forcing THAT into a
 * release-or-delete would be answering a false alarm with real damage. So the
 * move is still available, last, quiet, and with the caveat spelled out.
 */
interface TransferRepointDialogProps {
  /** Where the transfer will face afterwards, for the copy. */
  targetAccountName: string;
  /** Where the displaced counterpart lives now; absent when it is not loaded. */
  displacedAccountName?: string;
  /** The counterpart itself, when it is loaded — for the amount and the date. */
  counterpart: Transaction | null;
  /** Why the app could not tell what this row is. First entry is the headline. */
  reasons: string[];
  busy: boolean;
  onChoose: (disposition: TransferDisplacedDisposition) => void;
  onCancel: () => void;
}

export default function TransferRepointDialog({
  targetAccountName,
  displacedAccountName,
  counterpart,
  reasons,
  busy,
  onChoose,
  onCancel,
}: TransferRepointDialogProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // A question the user did not ask for gets the keyboard, so it can be
  // answered or dismissed without reaching for the mouse. The recommended
  // answer — leave the row alone — is where the cursor lands, because it is the
  // only one of the three that cannot lose anything.
  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  const where = displacedAccountName ? `in ${displacedAccountName}` : 'in the account it sits in';

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="repoint-title"
      aria-describedby="repoint-why"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <ArrowRightLeftIcon size={22} className="text-blue-600 dark:text-blue-400" />
          <h3 id="repoint-title" className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            What should happen to the other side?
          </h3>
        </div>

        <p id="repoint-why" className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          This transfer is moving to {targetAccountName}. Its other half is a transaction{' '}
          {where}
          {counterpart
            ? ` for ${counterpart.amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(counterpart.amount))} on ${new Date(counterpart.date).toLocaleDateString()}`
            : ''}
          , and it might be a real one rather than one this app created —{' '}
          {reasons[0] ?? 'nothing about it says where it came from'}. Moving a transaction that
          came from a bank into a different account would put both registers out by its amount.
        </p>

        <div className="space-y-2">
          <button
            ref={firstButtonRef}
            type="button"
            onClick={() => onChoose('release')}
            disabled={busy}
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="block font-medium text-gray-900 dark:text-white">
              Leave it where it is
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              It stays {where}, same amount and date, as an ordinary uncategorised transaction
              waiting to be filed. A fresh other side is created in {targetAccountName}.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChoose('delete')}
            disabled={busy}
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-400 dark:hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="block font-medium text-red-700 dark:text-red-400">
              Delete it
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              It is removed and {displacedAccountName ?? 'that account'}&rsquo;s balance goes back
              by its amount. Only if this transaction was never real. A fresh other side is created
              in {targetAccountName}.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChoose('move')}
            disabled={busy}
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="block font-medium text-gray-900 dark:text-white">
              Move it to {targetAccountName}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              The same transaction changes account, carrying its amount from{' '}
              {displacedAccountName ?? 'that account'} to {targetAccountName}. Right if this row was
              only ever the app&rsquo;s own bookkeeping for the transfer.
            </span>
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
