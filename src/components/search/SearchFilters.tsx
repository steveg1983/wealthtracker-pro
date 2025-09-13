/**
 * Search Filters Component
 * Advanced filter UI for search functionality
 */

import React, { useEffect, memo } from 'react';
import { searchService } from '../../services/searchService';
import type { SearchOptions } from '../../services/searchService';
import { logger } from '../../services/loggingService';

interface SearchFiltersProps {
  options: SearchOptions;
  onOptionsChange: (options: Partial<SearchOptions>) => void;
}

export const SearchFilters = memo(function SearchFilters({
  options,
  onOptionsChange
}: SearchFiltersProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SearchFilters component initialized', {
      componentName: 'SearchFilters'
    });
  }, []);

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    onOptionsChange({ [field]: value });
  };

  const handleAmountChange = (field: 'amountMin' | 'amountMax', value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    onOptionsChange({ [field]: numValue });
  };

  const handleTypeToggle = (type: 'income' | 'expense' | 'transfer', checked: boolean) => {
    const currentTypes = options.types || [];
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter(t => t !== type);
    onOptionsChange({ types: newTypes.length > 0 ? newTypes : undefined });
  };

  return (
    <div className="p-4 bg-blue-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white mb-3">Advanced Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Date Range */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={options.dateFrom ? new Date(options.dateFrom).toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              aria-label="Start date"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={options.dateTo ? new Date(options.dateTo).toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              aria-label="End date"
            />
          </div>
        </div>

        {/* Amount Range */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Min"
              value={options.amountMin || ''}
              onChange={(e) => handleAmountChange('amountMin', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              aria-label="Minimum amount"
            />
            <span className="text-gray-500">to</span>
            <input
              type="number"
              step="0.01"
              placeholder="Max"
              value={options.amountMax || ''}
              onChange={(e) => handleAmountChange('amountMax', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              aria-label="Maximum amount"
            />
          </div>
        </div>

        {/* Transaction Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Transaction Type
          </label>
          <div className="space-y-1">
            {(['income', 'expense', 'transfer'] as const).map(type => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.types?.includes(type) || false}
                  onChange={(e) => handleTypeToggle(type, e.target.checked)}
                  className="rounded text-gray-600 focus:ring-gray-500"
                  aria-label={`Include ${type} transactions`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                  {type}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <select
            value={options.cleared === true ? 'cleared' : options.cleared === false ? 'uncleared' : 'all'}
            onChange={(e) => {
              const value = e.target.value;
              onOptionsChange({
                cleared: value === 'all' ? undefined : value === 'cleared'
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="Transaction status"
          >
            <option value="all">All</option>
            <option value="cleared">Cleared</option>
            <option value="uncleared">Uncleared</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sort By
          </label>
          <select
            value={options.sortBy || 'date'}
            onChange={(e) => onOptionsChange({ sortBy: e.target.value as 'date' | 'amount' | 'description' | 'relevance' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="Sort by field"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="description">Description</option>
            <option value="relevance">Relevance</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sort Order
          </label>
          <select
            value={options.sortOrder || 'desc'}
            onChange={(e) => onOptionsChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="Sort order"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Quick Date Presets */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Date Filters</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Today', value: 'today' },
            { label: 'This Week', value: 'this week' },
            { label: 'This Month', value: 'this month' },
            { label: 'Last Month', value: 'last month' },
            { label: 'This Year', value: 'this year' },
          ].map(preset => (
            <button
              key={preset.value}
              onClick={() => {
                const parsed = searchService.parseNaturalLanguageQuery(preset.value);
                onOptionsChange({
                  dateFrom: parsed.dateFrom,
                  dateTo: parsed.dateTo
                });
              }}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Filter by ${preset.label.toLowerCase()}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});