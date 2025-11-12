import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SearchIcon, FilterIcon, XIcon } from './icons';
import { IconButton } from './icons/IconButton';
import { Modal } from './common/Modal';
// import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal'; // Currently unused
import { useDebounce } from '../hooks/useDebounce';
import type { Transaction, Account } from '../types';

interface SearchFilter {
  id: string;
  label: string;
  type: 'text' | 'date' | 'amount' | 'select' | 'multiselect';
  field: string;
  value: string | string[] | number | boolean | null;
  options?: { value: string; label: string }[];
}

interface AdvancedSearchProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: { id: string; name: string }[];
  onResults: (results: Transaction[]) => void;
  className?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilter[];
  createdAt: Date;
}

export default function AdvancedSearch({
  transactions,
  accounts,
  categories,
  onResults,
  className = ''
}: AdvancedSearchProps): React.JSX.Element {
  // const { formatCurrency } = useCurrencyDecimal(); // Currently unused
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState('');

  const [filters, setFilters] = useState<SearchFilter[]>([
    {
      id: 'description',
      label: 'Description',
      type: 'text',
      field: 'description',
      value: ''
    },
    {
      id: 'category',
      label: 'Category',
      type: 'multiselect',
      field: 'category',
      value: [],
      options: categories.map(cat => ({ value: cat.id, label: cat.name }))
    },
    {
      id: 'account',
      label: 'Account',
      type: 'multiselect',
      field: 'accountId',
      value: [],
      options: accounts.map(acc => ({ value: acc.id, label: acc.name }))
    },
    {
      id: 'amount_min',
      label: 'Min Amount',
      type: 'amount',
      field: 'amount',
      value: ''
    },
    {
      id: 'amount_max',
      label: 'Max Amount',
      type: 'amount',
      field: 'amount',
      value: ''
    },
    {
      id: 'date_from',
      label: 'From Date',
      type: 'date',
      field: 'date',
      value: ''
    },
    {
      id: 'date_to',
      label: 'To Date',
      type: 'date',
      field: 'date',
      value: ''
    },
    {
      id: 'type',
      label: 'Type',
      type: 'select',
      field: 'type',
      value: '',
      options: [
        { value: '', label: 'All Types' },
        { value: 'income', label: 'Income' },
        { value: 'expense', label: 'Expense' },
        { value: 'transfer', label: 'Transfer' }
      ]
    },
    {
      id: 'cleared',
      label: 'Status',
      type: 'select',
      field: 'cleared',
      value: '',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Cleared' },
        { value: 'false', label: 'Uncleared' }
      ]
    }
  ]);

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('advanced-searches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        const searches = parsed.map((search: Omit<SavedSearch, 'createdAt'> & { createdAt: string }) => ({
          ...search,
          createdAt: new Date(search.createdAt)
        }));
        setSavedSearches(searches);
      } catch (error) {
        console.error('Error loading saved searches:', error);
      }
    }
  }, []);

  // Save searches to localStorage
  const saveToLocalStorage = useCallback((searches: SavedSearch[]) => {
    localStorage.setItem('advanced-searches', JSON.stringify(searches));
  }, []);

  // Update filter value
  const updateFilter = useCallback((filterId: string, value: string | string[] | number | boolean | null) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, value } : filter
    ));
  }, []);

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    let results = transactions;

    // Apply search term
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      results = results.filter(transaction => 
        transaction.description.toLowerCase().includes(term) ||
        transaction.category.toLowerCase().includes(term) ||
        transaction.notes?.toLowerCase().includes(term) ||
        accounts.find(acc => acc.id === transaction.accountId)?.name.toLowerCase().includes(term)
      );
    }

    // Apply filters
    filters.forEach(filter => {
      if (!filter.value || filter.value === '' || (Array.isArray(filter.value) && filter.value.length === 0)) {
        return;
      }

      switch (filter.id) {
        case 'description':
          if (filter.value && typeof filter.value === 'string') {
            results = results.filter(t => 
              t.description.toLowerCase().includes((filter.value as string).toLowerCase())
            );
          }
          break;

        case 'category':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            results = results.filter(t => (filter.value as string[]).includes(t.category));
          }
          break;

        case 'account':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            results = results.filter(t => (filter.value as string[]).includes(t.accountId));
          }
          break;

        case 'amount_min':
          if (filter.value && (typeof filter.value === 'string' || typeof filter.value === 'number')) {
            const minAmount = parseFloat(String(filter.value));
            results = results.filter(t => t.amount >= minAmount);
          }
          break;

        case 'amount_max':
          if (filter.value && (typeof filter.value === 'string' || typeof filter.value === 'number')) {
            const maxAmount = parseFloat(String(filter.value));
            results = results.filter(t => t.amount <= maxAmount);
          }
          break;

        case 'date_from':
          if (filter.value && (typeof filter.value === 'string' || typeof filter.value === 'number')) {
            const fromDate = new Date(filter.value);
            results = results.filter(t => new Date(t.date) >= fromDate);
          }
          break;

        case 'date_to':
          if (filter.value && (typeof filter.value === 'string' || typeof filter.value === 'number')) {
            const toDate = new Date(filter.value);
            toDate.setHours(23, 59, 59, 999); // End of day
            results = results.filter(t => new Date(t.date) <= toDate);
          }
          break;

        case 'type':
          if (filter.value && typeof filter.value === 'string') {
            results = results.filter(t => t.type === filter.value);
          }
          break;

        case 'cleared':
          if (filter.value !== '') {
            const isCleared = filter.value === 'true';
            results = results.filter(t => t.cleared === isCleared);
          }
          break;
      }
    });

    return results;
  }, [transactions, accounts, debouncedSearchTerm, filters]);

  // Update results when filtered transactions change
  useEffect(() => {
    onResults(filteredTransactions);
  }, [filteredTransactions, onResults]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters(prev => prev.map(filter => ({
      ...filter,
      value: Array.isArray(filter.value) ? [] : ''
    })));
  }, []);

  // Save current search
  const saveCurrentSearch = useCallback(() => {
    if (!searchName.trim()) return;

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      filters: filters.filter(f => f.value && f.value !== '' && (!Array.isArray(f.value) || f.value.length > 0)),
      createdAt: new Date()
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    saveToLocalStorage(updated);
    setSearchName('');
    setShowSavedSearches(false);
  }, [searchName, filters, savedSearches, saveToLocalStorage]);

  // Load saved search
  const loadSavedSearch = useCallback((search: SavedSearch) => {
    setFilters(prev => {
      const updated = [...prev];
      search.filters.forEach(savedFilter => {
        const index = updated.findIndex(f => f.id === savedFilter.id);
        if (index !== -1) {
          updated[index] = { ...updated[index], value: savedFilter.value };
        }
      });
      return updated;
    });
    setShowSavedSearches(false);
  }, []);

  // Delete saved search
  const deleteSavedSearch = useCallback((searchId: string) => {
    const updated = savedSearches.filter(s => s.id !== searchId);
    setSavedSearches(updated);
    saveToLocalStorage(updated);
  }, [savedSearches, saveToLocalStorage]);

  const hasActiveFilters = useMemo(() => {
    return searchTerm.trim() !== '' || filters.some(filter => 
      filter.value && filter.value !== '' && (!Array.isArray(filter.value) || filter.value.length > 0)
    );
  }, [searchTerm, filters]);

  const renderFilter = (filter: SearchFilter): React.JSX.Element | null => {
    switch (filter.type) {
      case 'text':
        return (
          <input
            type="text"
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            placeholder={`Enter ${filter.label.toLowerCase()}`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );

      case 'amount':
        return (
          <input
            type="number"
            step="0.01"
            value={typeof filter.value === 'string' || typeof filter.value === 'number' ? filter.value : ''}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );

      case 'select':
        return (
          <select
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {filter.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {filter.options?.map(option => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Array.isArray(filter.value) && filter.value.includes(option.value)}
                  onChange={(e) => {
                    const currentValue = Array.isArray(filter.value) ? filter.value : [];
                    const newValue = e.target.checked
                      ? [...currentValue, option.value]
                      : currentValue.filter((v: string) => v !== option.value);
                    updateFilter(filter.id, newValue);
                  }}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-[#d4dce8] dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Search Bar */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions, accounts, categories..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <IconButton
            onClick={() => setIsExpanded(!isExpanded)}
            icon={<FilterIcon size={20} />}
            variant={hasActiveFilters ? 'primary' : 'ghost'}
            size="md"
            className={hasActiveFilters ? 'text-white' : 'text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}
            title="Advanced filters"
          />
          {hasActiveFilters && (
            <IconButton
              onClick={clearFilters}
              icon={<XIcon size={20} />}
              variant="ghost"
              size="md"
              className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Clear filters"
            />
          )}
        </div>

        {/* Results Summary */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {filteredTransactions.length} of {transactions.length} transactions
          </span>
          {savedSearches.length > 0 && (
            <button
              onClick={() => setShowSavedSearches(true)}
              className="text-primary hover:text-primary-dark"
            >
              Saved Searches ({savedSearches.length})
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filters.map(filter => (
              <div key={filter.id}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {filter.label}
                </label>
                {renderFilter(filter)}
              </div>
            ))}
          </div>

          {/* Save Search */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search name..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={saveCurrentSearch}
              disabled={!searchName.trim() || !hasActiveFilters}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Save Search
            </button>
          </div>
        </div>
      )}

      {/* Saved Searches Modal */}
      <Modal
        isOpen={showSavedSearches}
        onClose={() => setShowSavedSearches(false)}
        title="Saved Searches"
      >
        <div className="p-6">
          {savedSearches.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No saved searches yet
            </p>
          ) : (
            <div className="space-y-3">
              {savedSearches.map(search => (
                <div key={search.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{search.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {search.filters.length} filters • {search.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadSavedSearch(search)}
                      className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark"
                    >
                      Load
                    </button>
                    <IconButton
                      onClick={() => deleteSavedSearch(search.id)}
                      icon={<XIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}