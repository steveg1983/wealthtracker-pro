import React, { memo } from 'react';
import { SearchIcon, CalendarIcon, XIcon } from '../../components/icons';

interface TransactionFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: 'all' | 'income' | 'expense' | 'transfer';
  onTypeFilterChange: (type: 'all' | 'income' | 'expense' | 'transfer') => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
}

export const TransactionFilters = memo(function TransactionFilters({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange
}: TransactionFiltersProps) {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by description, amount, category..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
              />
            </div>
          </div>
          
          {/* Type Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
              <button
                onClick={() => onTypeFilterChange('all')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onTypeFilterChange('income')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === 'income'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => onTypeFilterChange('expense')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === 'expense'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Expense
              </button>
              <button
                onClick={() => onTypeFilterChange('transfer')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === 'transfer'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
        
        {/* Date Range */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-36 px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
              placeholder="From"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-36 px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
              placeholder="To"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  onDateFromChange('');
                  onDateToChange('');
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                title="Clear date range"
              >
                <XIcon size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});