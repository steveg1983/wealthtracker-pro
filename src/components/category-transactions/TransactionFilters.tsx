/**
 * Transaction Filters Component
 * Filter controls for category transactions
 */

import React, { useEffect, memo } from 'react';
import { CalendarIcon, SearchIcon, XCircleIcon } from '../icons';
import type { TransactionFilter } from '../../services/categoryTransactionsModalService';
import { logger } from '../../services/loggingService';

interface TransactionFiltersProps {
  transactionFilter: TransactionFilter;
  onTransactionFilterChange: (filter: TransactionFilter) => void;
  fromDate: string;
  onFromDateChange: (date: string) => void;
  toDate: string;
  onToDateChange: (date: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  totals: {
    income: number;
    expense: number;
    net: number;
  };
  formatCurrency: (amount: number) => string;
  categoryName: string;
}

export const TransactionFilters = memo(function TransactionFilters({
  transactionFilter,
  onTransactionFilterChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  searchQuery,
  onSearchQueryChange,
  totals,
  formatCurrency,
  categoryName
}: TransactionFiltersProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('TransactionFilters component initialized', {
        categoryName,
        componentName: 'TransactionFilters'
      });
    } catch (error) {
      logger.error('TransactionFilters initialization failed:', error, 'TransactionFilters');
    }
  }, [categoryName]);
  const isTransferCategory = categoryName.toLowerCase().includes('transfer');

  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
      {/* Transaction Type Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            try {
              logger.debug('All transactions filter selected', { componentName: 'TransactionFilters' });
              onTransactionFilterChange('all');
            } catch (error) {
              logger.error('Failed to apply all transactions filter:', error, 'TransactionFilters');
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            transactionFilter === 'all'
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-label="Show all transactions"
        >
          All Transactions
        </button>
        <button
          onClick={() => {
            try {
              logger.debug('Income filter selected', { componentName: 'TransactionFilters' });
              onTransactionFilterChange('income');
            } catch (error) {
              logger.error('Failed to apply income filter:', error, 'TransactionFilters');
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            transactionFilter === 'income'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-label="Show income only"
        >
          All Income
        </button>
        <button
          onClick={() => {
            try {
              logger.debug('Expense filter selected', { componentName: 'TransactionFilters' });
              onTransactionFilterChange('expense');
            } catch (error) {
              logger.error('Failed to apply expense filter:', error, 'TransactionFilters');
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            transactionFilter === 'expense'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-label="Show expenses only"
        >
          All Outgoings
        </button>
      </div>
      
      <div className="flex flex-col gap-3">
        {/* Date Range */}
        <div className="flex flex-wrap gap-2 items-center">
          <CalendarIcon className="text-gray-400 hidden sm:block" size={18} />
          <div className="flex flex-wrap gap-2 items-center flex-1">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                try {
                  logger.debug('Start date changed', { newDate: e.target.value, componentName: 'TransactionFilters' });
                  onFromDateChange(e.target.value);
                } catch (error) {
                  logger.error('Failed to update start date:', error, 'TransactionFilters');
                }
              }}
              className="flex-1 min-w-[130px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              aria-label="Start date"
            />
            <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                try {
                  logger.debug('End date changed', { newDate: e.target.value, componentName: 'TransactionFilters' });
                  onToDateChange(e.target.value);
                } catch (error) {
                  logger.error('Failed to update end date:', error, 'TransactionFilters');
                }
              }}
              className="flex-1 min-w-[130px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              aria-label="End date"
            />
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              try {
                logger.debug('Search query changed', { query: e.target.value, componentName: 'TransactionFilters' });
                onSearchQueryChange(e.target.value);
              } catch (error) {
                logger.error('Failed to update search query:', error, 'TransactionFilters');
              }
            }}
            placeholder="Search transactions..."
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            aria-label="Search transactions"
          />
          {searchQuery && (
            <button
              onClick={() => {
                try {
                  logger.debug('Search query cleared', { componentName: 'TransactionFilters' });
                  onSearchQueryChange('');
                } catch (error) {
                  logger.error('Failed to clear search query:', error, 'TransactionFilters');
                }
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Clear search"
              aria-label="Clear search"
            >
              <XCircleIcon size={18} />
            </button>
          )}
        </div>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">
            {isTransferCategory ? 'Money In:' : 'Income:'}
          </span>
          <span className="ml-2 font-medium text-green-600 dark:text-green-400">
            {formatCurrency(totals.income)}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">
            {isTransferCategory ? 'Money Out:' : 'Expense:'}
          </span>
          <span className="ml-2 font-medium text-red-600 dark:text-red-400">
            {formatCurrency(totals.expense)}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Net:</span>
          <span className={`ml-2 font-medium ${
            isTransferCategory && Math.abs(totals.net) < 0.01 
              ? 'text-green-600 dark:text-green-400' 
              : totals.net >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(totals.net)}
            {isTransferCategory && Math.abs(totals.net) < 0.01 && ' '}
          </span>
        </div>
      </div>
    </div>
  );
});