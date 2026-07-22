import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { sweepTransferPairs, type TransferPairSuggestion } from '../utils/transferSweep';
import { AlertTriangleIcon, ArrowRightIcon } from './icons';

/**
 * Bulk transfer matching: find every unlinked equal-and-opposite pair in the
 * history, let the user review and deselect, then link them all.
 *
 * Nothing links without an explicit tick. Ambiguous pairs (an equally-good
 * alternative existed) start UNSELECTED and are badged, because a wrong link
 * silently rewrites the meaning of two accounts.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CAP = 300;

export default function TransferSweepModal({ isOpen, onClose }: Props): React.JSX.Element {
  const { transactions, categories, accounts, linkTransferPair } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);

  const accountName = useMemo(() => {
    const byId = new Map(accounts.map(a => [a.id, a.name]));
    return (id: string): string => byId.get(id) ?? 'Unknown account';
  }, [accounts]);

  const { suggestions } = useMemo(() => {
    if (!isOpen) return { suggestions: [] as TransferPairSuggestion[] };
    return sweepTransferPairs(transactions, {
      onlyUncategorised: true,
      categoryIds: new Set(categories.map(c => c.id)),
    });
  }, [isOpen, transactions, categories]);

  const keyOf = (s: TransferPairSuggestion): string => `${s.outgoing.id}|${s.incoming.id}`;

  // Default selection: every unambiguous pair.
  const effectiveSelected = selected ?? new Set(
    suggestions.filter(s => !s.ambiguous).map(keyOf)
  );

  const toggle = (key: string): void => {
    const next = new Set(effectiveSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const visible = suggestions.slice(0, CAP);
  const chosen = suggestions.filter(s => effectiveSelected.has(keyOf(s)));

  const handleApply = async (): Promise<void> => {
    setApplying(true);
    setProgress(0);
    let linked = 0;
    let failed = 0;
    try {
      for (const pair of chosen) {
        try {
          await linkTransferPair(pair.outgoing.id, pair.incoming.id);
          linked++;
        } catch {
          failed++;
        }
        setProgress(linked + failed);
      }
      if (linked > 0) {
        showSuccess(
          `${linked.toLocaleString()} transfer pair${linked === 1 ? '' : 's'} linked${failed > 0 ? ` — ${failed} could not be linked` : ''}.`,
          'Transfers matched'
        );
      }
      if (linked === 0 && failed > 0) {
        showError(new Error('No pairs could be linked. Please try again.'));
      }
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={applying ? () => {} : onClose}
      closeOnBackdrop={!applying}
      title="Match transfers"
      size="xl"
    >
      <ModalBody>
        {suggestions.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            No unlinked transfer pairs found. Every equal-and-opposite movement in your
            history is already linked.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Found <strong>{suggestions.length.toLocaleString()}</strong> likely transfer
              pair{suggestions.length === 1 ? '' : 's'} — uncategorised rows that are exactly
              equal and opposite, in different accounts, within a few days. Linking them
              makes both sides transfers, so they leave your income and expense totals.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="pb-2 w-8"></th>
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-left pb-2 font-medium">From → To</th>
                    <th className="text-left pb-2 font-medium">Description</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => {
                    const key = keyOf(s);
                    return (
                      <tr key={key} className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={effectiveSelected.has(key)}
                            onChange={() => toggle(key)}
                            disabled={applying}
                            aria-label={`Link ${formatCurrency(Math.abs(s.outgoing.amount))} transfer`}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(s.outgoing.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          {s.daysApart > 0 && (
                            <span className="ml-1 text-xs text-gray-400">+{Math.round(s.daysApart)}d</span>
                          )}
                        </td>
                        <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <span className="truncate max-w-[140px]">{accountName(s.outgoing.accountId)}</span>
                            <ArrowRightIcon size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{accountName(s.incoming.accountId)}</span>
                          </span>
                          {s.ambiguous && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangleIcon size={12} />
                              check
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="block truncate max-w-[220px]">{s.outgoing.description}</span>
                        </td>
                        <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(Math.abs(s.outgoing.amount))}
                        </td>
                      </tr>
                    );
                  })}
                  {suggestions.length > CAP && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the first {CAP.toLocaleString()} of {suggestions.length.toLocaleString()} pairs —
                        link these, then run the sweep again for the rest.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {applying
              ? `Linking ${progress.toLocaleString()} of ${chosen.length.toLocaleString()}…`
              : `${chosen.length.toLocaleString()} of ${Math.min(suggestions.length, CAP).toLocaleString()} selected`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying || chosen.length === 0}
              className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? 'Linking…' : `Link ${chosen.length.toLocaleString()} pair${chosen.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
