import React, { useState, useMemo, useCallback } from 'react';
import { SearchIcon, PlusIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction, Category } from '../../types';

type FilterMode = 'all' | 'uncleared' | 'cleared';

interface ReconciliationTransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  currency?: string;
  openingBalance: number;
  onToggleCleared: (transactionId: string, cleared: boolean) => void;
  onAddTransaction: () => void;
}

export default function ReconciliationTransactionList({
  transactions,
  categories,
  currency,
  openingBalance,
  onToggleCleared,
  onAddTransaction,
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
                  ? 'bg-primary text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'uncleared' ? 'Uncleared' : 'Cleared'}
            </button>
          ))}
        </div>

        {/* Add transaction */}
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
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
                  className="grid grid-cols-[100px_50px_1fr_180px_120px_120px] gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-750 items-center text-sm"
                >
                  {/* Date */}
                  <div className="text-gray-700 dark:text-gray-300">
                    {new Date(t.date).toLocaleDateString('en-GB')}
                  </div>

                  {/* R/U checkbox */}
                  <div className="text-center">
                    <button
                      onClick={() => onToggleCleared(t.id, !t.cleared)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        t.cleared
                          ? 'bg-green-500 border-green-500 text-white'
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
                    {getCategoryName(t.category)}
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
