import React, { useEffect, memo } from 'react';
import type { Account, Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

export interface FilterOptions {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  accounts: string[];
  categories: string[];
  types: ('income' | 'expense' | 'transfer')[];
  searchTerm: string;
  amountRange: {
    min: number | null;
    max: number | null;
  };
}

interface TransactionFiltersPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  accounts: Account[];
  categories: Category[];
  showFilters: boolean;
}

export const TransactionFiltersPanel = memo(function TransactionFiltersPanel({ filters,
  onFiltersChange,
  accounts,
  categories,
  showFilters
 }: TransactionFiltersPanelProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('TransactionFiltersPanel component initialized', {
      componentName: 'TransactionFiltersPanel'
    });
  }, []);

  if (!showFilters) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date Range</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                dateRange: {
                  ...filters.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null
                }
              })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                       rounded bg-white dark:bg-gray-700"
            />
            <span className="self-center">to</span>
            <input
              type="date"
              value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                dateRange: {
                  ...filters.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null
                }
              })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                       rounded bg-white dark:bg-gray-700"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            placeholder="Search descriptions, notes, tags..."
            value={filters.searchTerm}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                     rounded bg-white dark:bg-gray-700"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Accounts</label>
          <select
            multiple
            value={filters.accounts}
            onChange={(e) => onFiltersChange({
              ...filters,
              accounts: Array.from(e.target.selectedOptions, opt => opt.value)
            })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                     rounded bg-white dark:bg-gray-700"
            size={3}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Categories</label>
          <select
            multiple
            value={filters.categories}
            onChange={(e) => onFiltersChange({
              ...filters,
              categories: Array.from(e.target.selectedOptions, opt => opt.value)
            })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                     rounded bg-white dark:bg-gray-700"
            size={3}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.types.includes('income')}
                onChange={(e) => {
                  if (e.target.checked) {
                    onFiltersChange({ ...filters, types: [...filters.types, 'income'] });
                  } else {
                    onFiltersChange({ ...filters, types: filters.types.filter(t => t !== 'income') });
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">Income</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.types.includes('expense')}
                onChange={(e) => {
                  if (e.target.checked) {
                    onFiltersChange({ ...filters, types: [...filters.types, 'expense'] });
                  } else {
                    onFiltersChange({ ...filters, types: filters.types.filter(t => t !== 'expense') });
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">Expense</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.types.includes('transfer')}
                onChange={(e) => {
                  if (e.target.checked) {
                    onFiltersChange({ ...filters, types: [...filters.types, 'transfer'] });
                  } else {
                    onFiltersChange({ ...filters, types: filters.types.filter(t => t !== 'transfer') });
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">Transfer</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});
