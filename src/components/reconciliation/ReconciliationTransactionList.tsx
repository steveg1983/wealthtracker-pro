import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SearchIcon, PlusIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { isMarkedAwaitingFinalize, isReconciled } from '../../utils/transactionReconciliation';
import type { Transaction, Category } from '../../types';

/**
 * What the list is showing.
 *
 * The vocabulary is the model: 'marked' is the WORKING set — ticked in this
 * session or a previous one, and not yet finalized — which is exactly what
 * Finalize would commit, so it doubles as "show me what I am about to sign
 * for". Rows reconciled in an earlier session are neither marked nor unmarked
 * work; they show under 'all' and nowhere else.
 */
type FilterMode = 'all' | 'unmarked' | 'marked';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All',
  unmarked: 'Unmarked',
  marked: 'Marked',
};

interface ReconciliationTransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  currency?: string;
  openingBalance: number;
  /** Ids with a mark-write in flight; their checkboxes are disabled. */
  pendingClearedIds?: ReadonlyMap<string, boolean>;
  onToggleCleared: (transactionId: string, cleared: boolean) => void;
  /** Bulk mark/unmark; ids are the currently visible (filtered) transactions. */
  onBulkSetCleared: (transactionIds: string[], cleared: boolean) => void;
  /** Open a transaction to edit its details/category. */
  onRowClick: (transaction: Transaction) => void;
  onAddTransaction: () => void;
  /**
   * Reports the currently visible transactions in display order (after sort +
   * filter + search) so a parent can drive "Save & Next" through the exact
   * order the user sees.
   */
  onVisibleOrderChange?: (orderedIds: string[]) => void;
}

/** Why a committed row's tick does not move here. */
const RECONCILED_ROW_TITLE =
  'Reconciled in a finished reconciliation. Un-tick it in the account register if it is wrong.';

export default function ReconciliationTransactionList({
  transactions,
  categories,
  currency,
  openingBalance,
  pendingClearedIds,
  onToggleCleared,
  onBulkSetCleared,
  onRowClick,
  onAddTransaction,
  onVisibleOrderChange,
}: ReconciliationTransactionListProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getCategoryName = useCallback((categoryId: string): string => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name ?? '';
  }, [categories]);

  // Sort by date ascending, then compute running balance
  const sortedTransactions = useMemo(() => {
    const typeOrder = { income: 0, transfer: 1, expense: 2 };
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }, [transactions]);

  // Running balance map
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    let running = openingBalance;
    for (const t of sortedTransactions) {
      running += t.amount;
      map.set(t.id, running);
    }
    return map;
  }, [sortedTransactions, openingBalance]);

  // Filter
  const filteredTransactions = useMemo(() => {
    let list = sortedTransactions;

    if (filterMode === 'unmarked') {
      list = list.filter(t => !t.cleared);
    } else if (filterMode === 'marked') {
      list = list.filter(isMarkedAwaitingFinalize);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(t =>
        t.description.toLowerCase().includes(lower) ||
        t.amount.toString().includes(lower) ||
        getCategoryName(t.category).toLowerCase().includes(lower)
      );
    }

    return list;
  }, [sortedTransactions, filterMode, searchTerm, getCategoryName]);

  // Surface the visible order upward so a parent can walk transactions in the
  // exact order shown here (used to drive the modal's "Save & Next").
  useEffect(() => {
    onVisibleOrderChange?.(filteredTransactions.map(t => t.id));
  }, [filteredTransactions, onVisibleOrderChange]);

  const visibleUnmarkedIds = useMemo(
    () => filteredTransactions.filter(t => t.cleared !== true).map(t => t.id),
    [filteredTransactions]
  );
  /**
   * Unmark acts on the WORKING set only — never on rows a finished
   * reconciliation committed. One click here can cover hundreds of rows, and a
   * bulk helper for this session's marks has no business reaching back into
   * settled statements.
   */
  const visibleMarkedIds = useMemo(
    () => filteredTransactions.filter(isMarkedAwaitingFinalize).map(t => t.id),
    [filteredTransactions]
  );

  const handleMarkAll = useCallback(() => {
    if (visibleUnmarkedIds.length === 0) return;
    // No confirmation. Marking is a working state that Finalize commits and a
    // second click undoes, so a modal asking "are you sure?" was asking about
    // nothing — and it was the popup that made "Mark all" feel like the
    // reconciliation itself.
    onBulkSetCleared(visibleUnmarkedIds, true);
  }, [visibleUnmarkedIds, onBulkSetCleared]);

  const handleUnmarkAll = useCallback(() => {
    if (visibleMarkedIds.length === 0) return;
    onBulkSetCleared(visibleMarkedIds, false);
  }, [visibleMarkedIds, onBulkSetCleared]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 basis-full sm:basis-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:text-white"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg p-0.5">
          {(['all', 'unmarked', 'marked'] as FilterMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              aria-pressed={filterMode === mode}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterMode === mode
                  ? 'bg-[#1a2332] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {FILTER_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Bulk actions. The labels say "mark", not "clear": now that marking is
            the holding state, promising anything more would be the old lie in
            new words. */}
        <button
          onClick={handleMarkAll}
          disabled={visibleUnmarkedIds.length === 0}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          title="Tick every transaction shown. Nothing is reconciled until you finalize."
        >
          Mark all
        </button>
        <button
          onClick={handleUnmarkAll}
          disabled={visibleMarkedIds.length === 0}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          title="Un-tick the transactions marked in this reconciliation. Already-reconciled rows are left alone."
        >
          Unmark all
        </button>

        {/* Add transaction */}
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-1 px-3 py-2 text-sm bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
        >
          <PlusIcon size={16} />
          Add
        </button>
      </div>

      {/* Transaction table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header. "C/R" is Money's own column: C is a mark, R is reconciled. */}
        <div className="hidden md:grid grid-cols-[100px_50px_1fr_180px_120px_120px] gap-2 px-4 py-2 bg-secondary dark:bg-gray-700 text-white text-xs font-medium">
          <div>Date</div>
          <div className="text-center" title="C = marked in this reconciliation · R = reconciled">C/R</div>
          <div>Description</div>
          <div>Category</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Balance</div>
        </div>

        {/* Rows */}
        <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {filteredTransactions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No transactions found
            </div>
          ) : (
            filteredTransactions.map(t => {
              const runningBal = balanceMap.get(t.id) ?? 0;
              const reconciled = isReconciled(t);

              return (
                <div
                  key={t.id}
                  onClick={() => onRowClick(t)}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 md:grid-cols-[100px_50px_1fr_180px_120px_120px] md:gap-2 px-4 py-3 md:py-2 hover:bg-gray-50 dark:hover:bg-gray-750 md:items-center text-sm cursor-pointer"
                  title="Click to edit this transaction"
                >
                  {/* Date */}
                  <div className="text-gray-700 dark:text-gray-300">
                    {new Date(t.date).toLocaleDateString('en-GB')}
                  </div>

                  {/* Mark / reconciled state. A committed row shows R and does
                      not move: a finished reconciliation is not undone by a
                      stray click on the screen you do the next one from. */}
                  <div className="flex justify-end md:block md:text-center">
                    <button
                      onClick={(e) => {
                        // The row itself opens the edit modal; keep the toggle isolated.
                        e.stopPropagation();
                        if (reconciled) return;
                        onToggleCleared(t.id, !t.cleared);
                      }}
                      disabled={reconciled || (pendingClearedIds?.has(t.id) ?? false)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors text-xs font-semibold disabled:cursor-not-allowed ${
                        reconciled
                          ? 'bg-gray-400 border-gray-400 text-white dark:bg-gray-500 dark:border-gray-500'
                          : t.cleared
                          ? 'bg-blue-600 border-blue-600 text-white disabled:opacity-60 disabled:cursor-wait'
                          : 'border-gray-300 dark:border-gray-500 hover:border-primary disabled:opacity-60 disabled:cursor-wait'
                      }`}
                      title={
                        reconciled
                          ? RECONCILED_ROW_TITLE
                          : t.cleared
                          ? 'Unmark this transaction'
                          : 'Mark this transaction'
                      }
                    >
                      {reconciled ? 'R' : t.cleared ? 'C' : ''}
                    </button>
                  </div>

                  {/* Description */}
                  <div className="col-span-2 md:col-span-1 text-gray-900 dark:text-white truncate">
                    {t.description}
                  </div>

                  {/* Category */}
                  <div className="text-gray-500 dark:text-gray-400 truncate">
                    {getCategoryName(t.category) || (
                      <span className="italic text-gray-400 dark:text-gray-500">Add category…</span>
                    )}
                  </div>

                  {/* Amount */}
                  <div className={`text-right font-medium ${
                    t.amount > 0
                      ? 'text-green-600 dark:text-green-400'
                      : t.amount < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {formatCurrency(t.amount, currency)}
                  </div>

                  {/* Running Balance */}
                  <div className={`col-span-2 md:col-span-1 text-right font-medium ${
                    runningBal < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {/* The column heading is gone on a phone, and a bare
                        second figure under the amount reads as a second
                        amount. */}
                    <span className="md:hidden text-xs font-normal text-gray-400 dark:text-gray-500 mr-1">Balance</span>
                    {formatCurrency(runningBal, currency)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
