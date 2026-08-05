import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import CategorySelector from './CategorySelector';
import { useAccountNames } from '../hooks/useAccountNames';
import { useNavigate, useLocation } from 'react-router-dom';
import IncomeExpenseBreakdownModal from './IncomeExpenseBreakdownModal';
import type { SplitExpandedTransaction } from '../utils/transactionSplits';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { buildPayeeGroups, type PayeeGroup } from '../utils/payeeGroups';
import { ArrowDownIcon, ArrowUpIcon, XIcon } from './icons';

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

type SortKey = 'payee' | 'rows' | 'total' | 'category';

/** Case-insensitive, so "Boots" and "BOOTS" sit together, not in two blocks. */
const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

export default function BulkCategorizeModal({ isOpen, onClose }: Props): React.JSX.Element {
  const { transactions, categories, applyCategoryToUncategorized } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Drill into ONE payee: its rows in the same inline-filing list the
  // one-by-one review uses — file a few by hand, save, come back, and bulk
  // the rest.
  const [drillGroup, setDrillGroup] = useState<PayeeGroup | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  // buildPayeeGroups already emits biggest-first (count desc, then total
  // desc), so Rows descending IS today's order — and Array#sort is stable, so
  // its total tie-break survives untouched until another column is clicked.
  const [sortKey, setSortKey] = useState<SortKey>('rows');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  // Closed accounts included — Money-era payees live in accounts long since
  // closed, and every one of them has a real name.
  const accountName = useAccountNames();

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

  /** The chosen category's display name, or '' while the payee is undecided. */
  const chosenName = (g: PayeeGroup): string => {
    const id = effectiveChoice(g);
    return id === '' ? '' : categoryName(id);
  };

  const compareGroups = (a: PayeeGroup, b: PayeeGroup): number => {
    switch (sortKey) {
      case 'payee':
        return sortDir * compareText(a.displayName, b.displayName);
      case 'rows':
        return sortDir * (a.count - b.count);
      // Group totals are magnitudes already, but Math.abs keeps the column
      // honest if a future group ever carries a signed total.
      case 'total':
        return sortDir * (Math.abs(a.total) - Math.abs(b.total));
      case 'category': {
        const an = chosenName(a);
        const bn = chosenName(b);
        // Undecided payees sink to the bottom in BOTH directions — hence not
        // multiplied by sortDir. This column is clicked to see what has
        // already been decided; a screenful of "Choose a category…" on top
        // would answer the opposite question.
        if (an === '' || bn === '') return an === bn ? 0 : an === '' ? 1 : -1;
        return sortDir * compareText(an, bn);
      }
    }
  };

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'rows' || key === 'total' ? -1 : 1);
    }
  };
  const arrow = (key: SortKey): string =>
    sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  // The cap is applied FIRST and the sort second, deliberately: the cap means
  // "the 100 biggest payees", and it goes on meaning that whichever column
  // the user sorts by afterwards. Sorting never pulls in a 101st payee.
  // (slice hands back a fresh array, so `groups` itself is never reordered.)
  const visible = groups.slice(0, CAP).sort(compareGroups);
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
      // 2xl: the category picker is the working column of this screen, and at
      // xl it was the cramped one — long "Parent > Child" names need the room.
      size="2xl"
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
            <div className="sm:overflow-x-auto">
              {/* Below sm the table reflows: each row becomes a grid with the
                  category picker on its own full-width line beneath the payee
                  — the four-column row forced sideways scrolling in portrait,
                  and the field being chosen was the part off-screen. */}
              <table className="block sm:table w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    {/* Headings sit CENTRED over their columns — the app-wide
                        convention. pr matches the body cells so each heading
                        centres on its column, not on the gap beside it. */}
                    {([
                      ['payee', 'Payee', 'pr-3', 'Sort by payee name'],
                      ['rows', 'Rows', 'pr-3', 'Sort by how many transactions'],
                      ['total', 'Total', 'pr-3', 'Sort by amount size'],
                      ['category', 'Category', 'w-80 lg:w-[26rem]', 'Sort by the category chosen — payees still undecided last'],
                    ] as const).map(([key, label, extra, hint]) => (
                      <th key={key} className={`text-center pb-2 font-medium ${extra}`}>
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          title={hint}
                        >
                          {label}{arrow(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group">
                  {visible.map(group => {
                    const key = keyOf(group);
                    const chosen = effectiveChoice(group);
                    return (
                      <tr key={key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-3 py-1 sm:py-0 sm:table-row border-b border-gray-50 dark:border-gray-700/50">
                        <td className="block sm:table-cell min-w-0 py-2 sm:pr-3">
                          <span className="flex items-center gap-1.5">
                            {group.direction === 'expense'
                              ? <ArrowDownIcon size={12} className="text-red-500 flex-shrink-0" />
                              : <ArrowUpIcon size={12} className="text-green-600 flex-shrink-0" />}
                            <button
                              type="button"
                              onClick={() => setDrillGroup(group)}
                              className="text-sm text-gray-900 dark:text-white truncate max-w-[220px] lg:max-w-[340px] text-left underline decoration-dotted underline-offset-2 decoration-gray-300 dark:decoration-gray-600 hover:text-blue-700 dark:hover:text-blue-400"
                              title={`See the ${group.count.toLocaleString()} transactions behind this payee`}
                            >
                              {group.displayName}
                            </button>
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
                        <td className="block sm:table-cell py-2 sm:pr-3 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {group.count.toLocaleString()}
                        </td>
                        <td className="block sm:table-cell py-2 sm:pr-3 text-sm text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(group.total)}
                        </td>
                        <td className="block sm:table-cell col-span-3 sm:col-auto pb-3 pt-0 sm:py-2">
                          <span className="flex items-center gap-1.5">
                            <CategorySelector
                              selectedCategory={chosen}
                              onCategoryChange={(categoryId) => setChoice(group, categoryId)}
                              transactionType={group.direction}
                              includeAllTypes
                              showHelperText={false}
                              usePortal
                              placeholder="Choose a category…"
                              className="w-full flex-1 min-w-0"
                            />
                            {/* The way OUT of a pre-fill: back to "Choose a
                                category…", excluding this payee from the
                                apply so its rows can be filed line by line.
                                The slot is RESERVED even when empty, so
                                every picker in the column is one width —
                                rows with and without a clear button used to
                                render pickers of different sizes. */}
                            <span className="w-8 shrink-0 flex justify-center">
                              {chosen !== '' && (
                                <button
                                  type="button"
                                  onClick={() => setChoice(group, '')}
                                  disabled={applying}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                  title="Clear — leave this payee to categorise line by line"
                                  aria-label={`Clear category for ${group.displayName}`}
                                >
                                  <XIcon size={14} />
                                </button>
                              )}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {groups.length > CAP && (
                    <tr className="block sm:table-row">
                      <td colSpan={4} className="block sm:table-cell py-3 text-center text-xs text-gray-400 dark:text-gray-500">
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
        {/* Stacked on phones: message, then two equal buttons. On one flex
            row the squeezed Cancel rendered its label off-centre. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {applying
              ? `Applying ${progress.toLocaleString()} of ${ready.length.toLocaleString()} payees…`
              : `${ready.length.toLocaleString()} payee${ready.length === 1 ? '' : 's'} ready — ${rowsCovered.toLocaleString()} transaction${rowsCovered === 1 ? '' : 's'}`}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:ml-auto">
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
      {/* One payee, opened up: the same inline-filing list as the
          one-by-one review — pick categories row by row, Save in the
          header, saved rows leave — scoped to this payee. Clicking a row
          jumps to the transaction IN ITS ACCOUNT's register (selected and
          scrolled to), for the times only the surrounding history can say
          what something was. */}
      {drillGroup && (
        <IncomeExpenseBreakdownModal
          isOpen
          onClose={() => setDrillGroup(null)}
          title={`${drillGroup.displayName} — ${drillGroup.count.toLocaleString()} uncategorised`}
          bucket="uncategorized"
          rows={drillGroup.transactionIds
            .map(id => transactions.find(t => t.id === id))
            .filter((t): t is NonNullable<typeof t> => t !== undefined) as SplitExpandedTransaction[]}
          total={null}
          categories={categories}
          onEditTransaction={(txnId) => {
            const txn = transactions.find(t => t.id === txnId);
            if (!txn) return;
            const params = new URLSearchParams();
            params.set('txn', txnId);
            if (new URLSearchParams(location.search).get('demo') === 'true') {
              params.set('demo', 'true');
            }
            setDrillGroup(null);
            onClose();
            navigate(`/accounts/${txn.accountId}?${params.toString()}`);
          }}
          onApplyCategories={async (assignments) => {
            let updated = 0;
            for (const [categoryId, ids] of assignments) {
              updated += await applyCategoryToUncategorized(ids, categoryId);
            }
            showSuccess(
              `${updated.toLocaleString()} transaction${updated === 1 ? '' : 's'} categorised.`,
              'Categories applied'
            );
            return updated;
          }}
        />
      )}
    </Modal>
  );
}
