import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import CategorySelector from './CategorySelector';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { buildPayeeGroups, type PayeeGroup } from '../utils/payeeGroups';
import { ArrowDownIcon, ArrowUpIcon } from './icons';

/**
 * Bulk categorise by payee: file a whole merchant in one decision.
 *
 * The review band is dominated by ordinary spending that never got a
 * category — the same merchants over and over. One decision per payee clears
 * dozens of rows, and because the app's payee memory keys on payee +
 * direction + account, the same decision also teaches future imports and
 * bank feeds.
 *
 * Groups where the payee has been filed before arrive pre-filled with the
 * category the user uses MOST for it (support count shown), so the common
 * case is: glance, confirm, apply.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CAP = 100;

export default function BulkCategorizeModal({ isOpen, onClose }: Props): React.JSX.Element {
  const { transactions, categories, accounts, applyCategoryToUncategorized } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);

  const accountName = useMemo(() => {
    const byId = new Map(accounts.map(a => [a.id, a.name]));
    return (id: string): string => byId.get(id) ?? 'Unknown account';
  }, [accounts]);

  const categoryName = useMemo(() => {
    const byId = new Map(categories.map(c => [c.id, c]));
    return (id: string): string => {
      const c = byId.get(id);
      if (!c) return '';
      const parent = c.parentId ? byId.get(c.parentId) : undefined;
      return parent && parent.level !== 'type' ? `${parent.name} : ${c.name}` : c.name;
    };
  }, [categories]);

  const groups = useMemo(
    () => (isOpen ? buildPayeeGroups(transactions, categories) : []),
    [isOpen, transactions, categories]
  );

  const keyOf = (g: PayeeGroup): string => `${g.payee}|${g.direction}`;

  /**
   * A suggestion is only pre-filled when the payee AGREES with itself.
   *
   * This screen applies a category to every row in a group at once, so a
   * pre-filled choice is one the user can accept without ever having examined
   * it. That is safe for a shop filed the same way 125 times out of 130, and
   * unsafe for a generic description — "ACCOUNT ADJUSTMENT", "UPDATE ON
   * PORTFOLIO VALUE" — filed a dozen different ways, where the most common
   * category is a plurality of a quarter and the rows behind it are portfolio
   * revaluations worth more than a year of real spending.
   *
   * Below the threshold the group still appears, still shows what the payee
   * has been filed as, and simply starts empty: it asks rather than assumes.
   */
  const SUGGESTION_MIN_AGREEMENT = 0.8;
  const suggestionIsTrustworthy = (g: PayeeGroup): boolean => {
    if (g.suggestedCategoryId === undefined) return false;
    const support = g.suggestionSupport ?? 0;
    const sample = g.suggestionSampleSize ?? support;
    if (sample <= 0) return false;
    return support / sample >= SUGGESTION_MIN_AGREEMENT;
  };

  // Pre-fill from the payee's own history; the user can change any of them.
  const effectiveChoice = (g: PayeeGroup): string =>
    choices[keyOf(g)] ?? (suggestionIsTrustworthy(g) ? (g.suggestedCategoryId ?? '') : '');

  const setChoice = (g: PayeeGroup, categoryId: string): void => {
    setChoices(prev => ({ ...prev, [keyOf(g)]: categoryId }));
  };

  const visible = groups.slice(0, CAP);
  const ready = visible.filter(g => effectiveChoice(g) !== '');
  const rowsCovered = ready.reduce((sum, g) => sum + g.count, 0);

  const handleApply = async (): Promise<void> => {
    setApplying(true);
    setProgress(0);
    let done = 0;
    let rows = 0;
    let failed = 0;
    try {
      for (const group of ready) {
        const category = effectiveChoice(group);
        try {
          // Only fills blanks — an explicit category is never overwritten.
          const updated = await applyCategoryToUncategorized(group.transactionIds, category);
          rows += updated;
        } catch {
          failed++;
        }
        done++;
        setProgress(done);
      }
      if (rows > 0) {
        showSuccess(
          `${rows.toLocaleString()} transaction${rows === 1 ? '' : 's'} categorised across ${(done - failed).toLocaleString()} payee${done - failed === 1 ? '' : 's'}.`,
          'Categories applied'
        );
      }
      if (failed > 0 && rows === 0) {
        showError(new Error('No transactions could be categorised. Please try again.'));
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
      title="Categorise by payee"
      size="xl"
    >
      <ModalBody>
        {groups.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            Nothing to categorise — every transaction with a payee already has a category.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              One decision files a whole merchant. Payees you have filed before arrive
              pre-filled with the category you use most for them — and whatever you choose
              here is remembered, so future imports and bank feeds categorise themselves.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left pb-2 font-medium">Payee</th>
                    <th className="text-right pb-2 font-medium">Rows</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                    <th className="text-left pb-2 font-medium w-72">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(group => {
                    const key = keyOf(group);
                    const chosen = effectiveChoice(group);
                    return (
                      <tr key={key} className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-1.5">
                            {group.direction === 'expense'
                              ? <ArrowDownIcon size={12} className="text-red-500 flex-shrink-0" />
                              : <ArrowUpIcon size={12} className="text-green-600 flex-shrink-0" />}
                            <span className="text-sm text-gray-900 dark:text-white truncate max-w-[220px]">
                              {group.displayName}
                            </span>
                          </span>
                          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(group.earliest).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                            {' – '}
                            {new Date(group.latest).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                            {group.accountIds.length === 1
                              ? ` · ${accountName(group.accountIds[0])}`
                              : ` · ${group.accountIds.length} accounts`}
                            {/* "9" reads the same out of 10 filings as out of
                                36, so the sample size is shown beside it and
                                a payee that disagrees with itself says so. */}
                            {group.suggestedCategoryId && (
                              suggestionIsTrustworthy(group) ? (
                                <> · usually {categoryName(group.suggestedCategoryId)}{' '}
                                  ({group.suggestionSupport} of {group.suggestionSampleSize ?? group.suggestionSupport})</>
                              ) : (
                                <> · filed inconsistently — {categoryName(group.suggestedCategoryId)}{' '}
                                  only {group.suggestionSupport} of {group.suggestionSampleSize ?? group.suggestionSupport} times</>
                              )
                            )}
                          </span>
                          {/* A deliberate recent change stays one click away
                              instead of being buried under an older habit. */}
                          {group.lastUsedCategoryId && chosen !== group.lastUsedCategoryId && (
                            <button
                              type="button"
                              onClick={() => setChoice(group, group.lastUsedCategoryId as string)}
                              disabled={applying}
                              className="mt-1 text-xs text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                              use last: {categoryName(group.lastUsedCategoryId)}
                            </button>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {group.count.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-sm text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(group.total)}
                        </td>
                        <td className="py-2">
                          <CategorySelector
                            selectedCategory={chosen}
                            onCategoryChange={(categoryId) => setChoice(group, categoryId)}
                            transactionType={group.direction}
                            includeAllTypes
                            showHelperText={false}
                            usePortal
                            placeholder="Choose a category…"
                            className="w-full"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {groups.length > CAP && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the {CAP} biggest payees of {groups.length.toLocaleString()} —
                        apply these, then reopen for the next batch.
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
              ? `Applying ${progress.toLocaleString()} of ${ready.length.toLocaleString()} payees…`
              : `${ready.length.toLocaleString()} payee${ready.length === 1 ? '' : 's'} ready — ${rowsCovered.toLocaleString()} transaction${rowsCovered === 1 ? '' : 's'}`}
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
              disabled={applying || ready.length === 0}
              className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? 'Applying…' : `Categorise ${rowsCovered.toLocaleString()} transaction${rowsCovered === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
