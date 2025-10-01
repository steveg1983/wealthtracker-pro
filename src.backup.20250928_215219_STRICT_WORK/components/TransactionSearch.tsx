import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  SearchIcon as Search,
  XIcon as X,
  FilterIcon as Filter,
  CalendarIcon as Calendar,
  DollarSignIcon as DollarSign,
  TagIcon as Tag,
  FileTextIcon as FileText
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import type { Transaction } from '../types';
import { debounce } from 'lodash';

interface TransactionSearchProps {
  onResultsChange?: (results: Transaction[]) => void;
  className?: string;
  placeholder?: string;
  showAdvanced?: boolean;
}

export default function TransactionSearch({ 
  onResultsChange,
  className = '',
  placeholder = 'Search transactions...',
  showAdvanced = true
}: TransactionSearchProps): React.JSX.Element {
  const { transactions, accounts, categories } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    category: '',
    account: '',
    type: 'all' as 'all' | 'income' | 'expense'
  });

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((term: string, currentFilters: typeof filters) => {
      const results = searchTransactions(term, currentFilters);
      if (onResultsChange) {
        onResultsChange(results);
      }
    }, 300),
    [transactions]
  );

  const searchTransactions = (term: string, currentFilters: typeof filters): Transaction[] => {
    let filtered = [...transactions];

    // Text search
    if (term) {
      const searchLower = term.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchLower) ||
        t.category.toLowerCase().includes(searchLower) ||
        t.notes?.toLowerCase().includes(searchLower) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Date filters
    if (currentFilters.dateFrom) {
      const fromTime = new Date(currentFilters.dateFrom).getTime();
      filtered = filtered.filter(t => new Date(t.date).getTime() >= fromTime);
    }
    if (currentFilters.dateTo) {
      const toTime = new Date(currentFilters.dateTo).getTime();
      filtered = filtered.filter(t => new Date(t.date).getTime() <= toTime);
    }

    // Amount filters
    if (currentFilters.amountMin) {
      filtered = filtered.filter(t => 
        Math.abs(t.amount) >= parseFloat(currentFilters.amountMin)
      );
    }
    if (currentFilters.amountMax) {
      filtered = filtered.filter(t => 
        Math.abs(t.amount) <= parseFloat(currentFilters.amountMax)
      );
    }

    // Category filter
    if (currentFilters.category) {
      filtered = filtered.filter(t => t.category === currentFilters.category);
    }

    // Account filter
    if (currentFilters.account) {
      filtered = filtered.filter(t => t.accountId === currentFilters.account);
    }

    // Type filter
    if (currentFilters.type !== 'all') {
      filtered = filtered.filter(t => {
        const amount = t.amount;
        return currentFilters.type === 'income' ? amount > 0 : amount < 0;
      });
    }

    // Sort by date descending
    return filtered.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  useEffect(() => {
    debouncedSearch(searchTerm, filters);
  }, [searchTerm, filters, debouncedSearch]);

  const handleClearSearch = () => {
    setSearchTerm('');
    setFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      category: '',
      account: '',
      type: 'all'
    });
  };

  const hasActiveFilters = searchTerm || Object.values(filters).some(v => v && v !== 'all');

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent"
        />
        {hasActiveFilters && (
          <button
            onClick={handleClearSearch}
            className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
        {showAdvanced && (
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
              isAdvancedOpen ? 'text-gray-500' : 'text-gray-400'
            } hover:text-gray-600`}
          >
            <Filter size={18} />
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && isAdvancedOpen && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Advanced Filters
          </h3>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                <Calendar size={14} className="inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                <Calendar size={14} className="inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                <DollarSign size={14} className="inline mr-1" />
                Min Amount
              </label>
              <input
                type="number"
                value={filters.amountMin}
                onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                <DollarSign size={14} className="inline mr-1" />
                Max Amount
              </label>
              <input
                type="number"
                value={filters.amountMax}
                onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                placeholder="999999.99"
                step="0.01"
                min="0"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          {/* Category and Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                <Tag size={14} className="inline mr-1" />
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                <option value="">All Categories</option>
                {Array.from(new Set(transactions.map(t => t.category))).sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                <FileText size={14} className="inline mr-1" />
                Account
              </label>
              <select
                value={filters.account}
                onChange={(e) => setFilters(prev => ({ ...prev, account: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                <option value="">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
              Transaction Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, type: 'all' }))}
                className={`px-3 py-1 text-sm rounded ${
                  filters.type === 'all' 
                    ? 'bg-gray-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, type: 'income' }))}
                className={`px-3 py-1 text-sm rounded ${
                  filters.type === 'income' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, type: 'expense' }))}
                className={`px-3 py-1 text-sm rounded ${
                  filters.type === 'expense' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Expenses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
