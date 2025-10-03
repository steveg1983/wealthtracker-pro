/**
 * Transaction Filters Component
 * Filter controls for category transactions
 */

import React, { useEffect } from 'react';
import { CalendarIcon, SearchIcon, XCircleIcon } from '../icons';
import type { TransactionFilter, FilterOptions } from '../../services/categoryTransactionsModalService';
import { useLogger } from '../services/ServiceProvider';

interface TransactionFiltersProps {
  filterOptions: FilterOptions;
  hasActiveFilters: boolean;
  onFilterUpdate: <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => void;
  onClearFilters: () => void;
}

const TransactionFilters = React.memo(({
  filterOptions,
  hasActiveFilters,
  onFilterUpdate,
  onClearFilters
}: TransactionFiltersProps) => {
  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          value={filterOptions.searchQuery}
          onChange={(e) => onFilterUpdate('searchQuery', e.target.value)}
          placeholder="Search transactions..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="date"
            value={filterOptions.fromDate}
            onChange={(e) => onFilterUpdate('fromDate', e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="From date"
          />
        </div>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="date"
            value={filterOptions.toDate}
            onChange={(e) => onFilterUpdate('toDate', e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="To date"
          />
        </div>
      </div>

      {/* Transaction Type Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => onFilterUpdate('transactionFilter', 'all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterOptions.transactionFilter === 'all'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterUpdate('transactionFilter', 'income')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterOptions.transactionFilter === 'income'
              ? 'bg-green-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
          }`}
        >
          Income
        </button>
        <button
          onClick={() => onFilterUpdate('transactionFilter', 'expense')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterOptions.transactionFilter === 'expense'
              ? 'bg-red-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
          }`}
        >
          Expenses
        </button>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <XCircleIcon className="h-4 w-4" />
          Clear all filters
        </button>
      )}
    </div>
  );
});

TransactionFilters.displayName = 'TransactionFilters';

export default TransactionFilters;