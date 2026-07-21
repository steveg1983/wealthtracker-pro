import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { ArrowRightLeftIcon } from './icons';
import type { Transaction } from '../types';
import type { TransferCandidate } from '../utils/transferMatch';

/**
 * The Money-style transfer confirmation. Shown when a transaction is filed
 * under a "To/From <account>" category:
 *
 *   - match(es) found in the other account → confirm linking (balance-neutral;
 *     both rows already exist and are simply joined), picking one when several
 *     qualify;
 *   - nothing found → offer to CREATE the other side, Money-style (this moves
 *     the target account's balance — which is why it always confirms first;
 *     the system never silently invents money movements).
 */
interface TransferMatchDialogProps {
  isOpen: boolean;
  source: Transaction;
  sourceAccountName: string;
  targetAccountName: string;
  candidates: TransferCandidate[];
  busy: boolean;
  onLink: (candidateId: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export default function TransferMatchDialog({
  isOpen,
  source,
  sourceAccountName,
  targetAccountName,
  candidates,
  busy,
  onLink,
  onCreate,
  onCancel,
}: TransferMatchDialogProps): React.JSX.Element | null {
  const { formatCurrency } = useCurrencyDecimal();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Preselect the best match whenever the dialog (re)opens.
  useEffect(() => {
    if (isOpen) {
      setSelectedId(candidates[0]?.transaction.id ?? null);
    }
  }, [isOpen, candidates]);

  if (!isOpen) return null;

  const isOutgoing = source.amount < 0;
  const magnitude = formatCurrency(Math.abs(source.amount));
  const directionText = isOutgoing
    ? `${magnitude} from ${sourceAccountName} to ${targetAccountName}`
    : `${magnitude} from ${targetAccountName} to ${sourceAccountName}`;

  // Portal to document.body: rendered in place, a transformed ancestor (the
  // page-transition wrapper) would re-anchor position:fixed and trap the
  // z-index beneath the portalled Modal — the dialog existed but never
  // painted on top.
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <ArrowRightLeftIcon size={22} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Make this a transfer
          </h3>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
          {directionText}
        </p>

        {candidates.length > 0 ? (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              {candidates.length === 1
                ? `Found the matching transaction in ${targetAccountName} — link the two sides?`
                : `Found ${candidates.length} possible matches in ${targetAccountName} — pick the other side:`}
            </p>
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto" role="radiogroup" aria-label="Matching transactions">
              {candidates.slice(0, 6).map(candidate => {
                const t = candidate.transaction;
                const isSelected = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{t.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {new Date(t.date).toLocaleDateString()}
                          {candidate.daysApart > 0 && ` • ${Math.round(candidate.daysApart)} day${Math.round(candidate.daysApart) === 1 ? '' : 's'} apart`}
                        </p>
                      </div>
                      <span className={`shrink-0 font-medium ${t.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {t.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 justify-end items-center">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={busy}
                title={`Ignore the matches and create a brand-new transaction in ${targetAccountName}`}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Create new instead
              </button>
              <button
                type="button"
                onClick={() => selectedId && onLink(selectedId)}
                disabled={busy || !selectedId}
                className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Linking…' : 'Link as transfer'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              No matching transaction was found in {targetAccountName} (same amount, within a few
              days). Create the other side there? This adds a new transaction and adjusts{' '}
              {targetAccountName}&rsquo;s balance.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={busy}
                className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Creating…' : 'Create the other side'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
