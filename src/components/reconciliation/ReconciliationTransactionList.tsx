import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SearchIcon, PlusIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction, Category } from '../../types';

type FilterMode = 'all' | 'uncleared' | 'cleared';

interface ReconciliationTransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  currency?: string;
  openingBalance: number;
  /** Ids with a cleared-write in flight; their checkboxes are disabled. */
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

    if (filterMode === 'uncleared') {
      list = list.filter(t => !t.cleared);
    } else if (filterMode === 'cleared') {
      list = list.filter(t => t.cleared === true);
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

  const visibleUnclearedIds = useMemo(
    () => filteredTransactions.filter(t => t.cleared !== true).map(t => t.id),
    [filteredTransactions]
  );
  const visibleClearedIds = useMemo(
    () => filteredTransactions.filter(t => t.cleared === true).map(t => t.id),
    [filteredTransactions]
  );

  const handleMarkAllCleared = useCallback(() => {
    const count = visibleUnclearedIds.length;
    if (count === 0) return;
    if (window.confirm(`Mark ${count} transaction${count === 1 ? '' : 's'} as cleared?`)) {
      onBulkSetCleared(visibleUnclearedIds, true);
    }
  }, [visibleUnclearedIds, onBulkSetCleared]);

  const handleUnmarkAll = useCallback(() => {
    const count = visibleClearedIds.length;
    if (count === 0) return;
    if (window.confirm(`Mark ${count} transaction${count === 1 ? '' : 's'} as uncleared?`)) {
      onBulkSetCleared(visibleClearedIds, false);
    }
  }, [visibleClearedIds, onBulkSetCleared]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
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
          {(['all', 'uncleared', 'cleared'] as FilterMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterMode === mode
                  ? 'bg-[#1a2332] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'uncleared' ? 'Uncleared' : 'Cleared'}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        <button
          onClick={handleMarkAllCleared}
          disabled={visibleUnclearedIds.length === 0}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          title="Mark all currently shown transactions as cleared"
        >
          Mark all cleared
        </button>
        <button
          onClick={handleUnmarkAll}
          disabled={visibleClearedIds.length === 0}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          title="Mark all currently shown transactions as uncleared"
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
        {/* Header */}
        <div className="grid grid-cols-[100px_50px_1fr_180px_120px_120px] gap-2 px-4 py-2 bg-secondary dark:bg-gray-700 text-white text-xs font-medium">
          <div>Date</div>
          <div className="text-center">R</div>
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

              return (
                <div
                  key={t.id}
                  onClick={() => onRowClick(t)}
                  className="grid grid-cols-[100px_50px_1fr_180px_120px_120px] gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-750 items-center text-sm cursor-pointer"
                  title="Click to edit this transaction"
                >
                  {/* Date */}
                  <div className="text-gray-700 dark:text-gray-300">
                    {new Date(t.date).toLocaleDateString('en-GB')}
                  </div>

                  {/* R/U checkbox */}
                  <div className="text-center">
                    <button
                      onClick={(e) => {
                        // The row itself opens the edit modal; keep the toggle isolated.
                        e.stopPropagation();
                        onToggleCleared(t.id, !t.cleared);
                      }}
                      disabled={pendingClearedIds?.has(t.id) ?? false}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-wait ${
                        t.cleared
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 dark:border-gray-500 hover:border-primary'
                      }`}
                      title={t.cleared ? 'Mark as uncleared' : 'Mark as cleared'}
                    >
                      {t.cleared ? 'R' : ''}
                    </button>
                  </div>

                  {/* Description */}
                  <div className="text-gray-900 dark:text-white truncate">
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
                  <div className={`text-right font-medium ${
                    runningBal < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
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
