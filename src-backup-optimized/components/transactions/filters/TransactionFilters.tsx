import React, { useEffect, Suspense, lazy } from 'react';
import { SearchIcon, CalendarIcon } from '../../icons';
import type { Account } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

const QuickDateFilters = lazy(() => import('../../QuickDateFilters'));

interface TransactionFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'income' | 'expense';
  onFilterTypeChange: (value: 'all' | 'income' | 'expense') => void;
  filterAccountId: string;
  onFilterAccountChange: (value: string) => void;
  accounts: Account[];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onQuickDateSelect: (from: string, to: string) => void;
  t: (key: string, fallback?: string) => string;
}

export function TransactionFilters({ searchQuery,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterAccountId,
  onFilterAccountChange,
  accounts,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onQuickDateSelect,
  t
 }: TransactionFiltersProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
      <div className="space-y-3">
        {/* Search Input */}
        <div className="w-full">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t('transactions.searchTransactions')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            />
          </div>
        </div>
        
        {/* Filter Row */}
        <div className="flex flex-wrap gap-2">
          {/* Type Filter */}
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="type-filter" className="sr-only">Transaction type filter</label>
            <select
              id="type-filter"
              className="w-full px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              value={filterType}
              onChange={(e) => onFilterTypeChange(e.target.value as 'all' | 'income' | 'expense')}
              aria-label="Filter transactions by type"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>
          
          {/* Account Filter */}
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="account-filter" className="sr-only">Account filter</label>
            <select
              id="account-filter"
              className="w-full px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              value={filterAccountId}
              onChange={(e) => onFilterAccountChange(e.target.value)}
              aria-label="Filter transactions by account"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Quick Date Filters */}
        <Suspense fallback={<div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />}>
          <QuickDateFilters 
            onDateRangeSelect={onQuickDateSelect}
            currentFrom={dateFrom}
            currentTo={dateTo}
          />
        </Suspense>
        
        {/* Custom Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Range:</span>
          <label htmlFor="date-from" className="sr-only">From date</label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            placeholder="From"
            aria-label="Filter from date"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
          <label htmlFor="date-to" className="sr-only">To date</label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            placeholder="To"
            aria-label="Filter to date"
          />
        </div>
      </div>
    </div>
  );
}