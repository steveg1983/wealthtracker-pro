import React, { useEffect } from 'react';
import CategorySelect from '../../CategorySelect';
import type { Category } from '../../../types';
import { logger } from '../../../services/loggingService';

interface ReconciliationFiltersProps {
  showFilters: boolean;
  onToggleFilters: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  amountMin: string;
  onAmountMinChange: (value: string) => void;
  amountMax: string;
  onAmountMaxChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  categories: Category[];
  onClearFilters?: () => void;
}

export function ReconciliationFilters({
  showFilters,
  onToggleFilters,
  searchQuery,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  amountMin,
  onAmountMinChange,
  amountMax,
  onAmountMaxChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onClearFilters
}: ReconciliationFiltersProps): React.JSX.Element {
  const hasActiveFilters = searchQuery || dateFrom || dateTo || amountMin || amountMax || selectedCategory;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Filters</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onToggleFilters}
            className="text-sm text-primary hover:text-secondary"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>
      
      {showFilters && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          {/* Filter row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date range */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            {/* Amount range */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Min Amount</label>
              <input
                type="number"
                placeholder="0.00"
                value={amountMin}
                onChange={(e) => onAmountMinChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Max Amount</label>
              <input
                type="number"
                placeholder="0.00"
                value={amountMax}
                onChange={(e) => onAmountMaxChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                step="0.01"
              />
            </div>
            
            {/* Category filter */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
              <CategorySelect
                value={selectedCategory}
                onChange={onCategoryChange}
                categories={categories}
                placeholder="All Categories"
                className="w-full"
              />
            </div>
          </div>
          
          {hasActiveFilters && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Filters applied: {[
                searchQuery && 'search',
                (dateFrom || dateTo) && 'date',
                (amountMin || amountMax) && 'amount',
                selectedCategory && 'category'
              ].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}