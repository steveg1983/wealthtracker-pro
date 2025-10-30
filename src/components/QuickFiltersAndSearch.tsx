import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FilterIcon,
  SaveIcon,
  ClockIcon,
  StarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  DollarSignIcon,
  TagIcon,
  SearchIcon,
  XIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PlusIcon,
  TrashIcon,
  EditIcon
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import type { Transaction } from '../types';

interface FilterPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  filter: (transaction: Transaction) => boolean;
  description?: string;
  isCustom?: boolean;
  searchQuery?: string;
  dateRange?: { start: Date | null; end: Date | null };
  categories?: string[];
  accounts?: string[];
  amountRange?: { min: number | null; max: number | null };
  types?: ('income' | 'expense' | 'transfer')[];
}

interface QuickFiltersProps {
  onFilterChange: (filter: (transaction: Transaction) => boolean) => void;
  onSearchChange?: (query: string) => void;
  transactions: Transaction[];
  compact?: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<FilterPreset>;
  createdAt: Date;
  usageCount: number;
}

/**
 * Quick Filters & Saved Searches Component
 * Design principles:
 * 1. One-click preset filters for common views
 * 2. Save custom filter combinations
 * 3. Recent searches with smart suggestions
 * 4. Mobile-optimized filter pills
 * 5. Visual indicators for active filters
 */
export function QuickFiltersAndSearch({ 
  onFilterChange, 
  onSearchChange,
  transactions,
  compact = false 
}: QuickFiltersProps): React.JSX.Element {
  const { categories, accounts } = useApp();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Load saved searches and recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wealthtracker_savedSearches');
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved searches:', e);
      }
    }
    
    const recent = localStorage.getItem('wealthtracker_recentSearches');
    if (recent) {
      try {
        setRecentSearches(JSON.parse(recent));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  // Save searches to localStorage
  useEffect(() => {
    localStorage.setItem('wealthtracker_savedSearches', JSON.stringify(savedSearches));
  }, [savedSearches]);

  useEffect(() => {
    localStorage.setItem('wealthtracker_recentSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // Default preset filters
  const presetFilters: FilterPreset[] = useMemo(() => [
    {
      id: 'all',
      name: 'All',
      icon: <CheckCircleIcon size={16} />,
      filter: () => true,
      description: 'Show all transactions'
    },
    {
      id: 'today',
      name: 'Today',
      icon: <CalendarIcon size={16} />,
      filter: (t: any) => {
        const today = new Date();
        const tDate = new Date(t.date);
        return tDate.toDateString() === today.toDateString();
      },
      description: 'Transactions from today'
    },
    {
      id: 'week',
      name: 'This Week',
      icon: <ClockIcon size={16} />,
      filter: (t: any) => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return new Date(t.date) >= weekAgo;
      },
      description: 'Last 7 days'
    },
    {
      id: 'month',
      name: 'This Month',
      icon: <CalendarIcon size={16} />,
      filter: (t: any) => {
        const now = new Date();
        const tDate = new Date(t.date);
        return tDate.getMonth() === now.getMonth() && 
               tDate.getFullYear() === now.getFullYear();
      },
      description: 'Current month only'
    },
    {
      id: 'income',
      name: 'Income',
      icon: <TrendingUpIcon size={16} />,
      filter: (t: any) => t.type === 'income',
      description: 'Income transactions only'
    },
    {
      id: 'expenses',
      name: 'Expenses',
      icon: <TrendingDownIcon size={16} />,
      filter: (t: any) => t.type === 'expense',
      description: 'Expense transactions only'
    },
    {
      id: 'large',
      name: 'Large',
      icon: <DollarSignIcon size={16} />,
      filter: (t: any) => Math.abs(t.amount) >= 500,
      description: 'Transactions over $500'
    },
    {
      id: 'uncategorized',
      name: 'Uncategorized',
      icon: <AlertCircleIcon size={16} />,
      filter: (t: any) => !t.category || t.category === '',
      description: 'Need categorization'
    },
    {
      id: 'uncleared',
      name: 'Uncleared',
      icon: <XIcon size={16} />,
      filter: (t: any) => !t.cleared,
      description: 'Not reconciled'
    }
  ], []);

  // Combine preset and saved filters
  const allFilters = useMemo(() => {
    const customFilters: FilterPreset[] = savedSearches.map(search => ({
      id: search.id,
      name: search.name,
      icon: <StarIcon size={16} />,
      filter: (t: Transaction) => {
        // Apply search query
        if (search.query) {
          const query = search.query.toLowerCase();
          if (!t.description.toLowerCase().includes(query) &&
              !t.category?.toLowerCase().includes(query) &&
              !t.notes?.toLowerCase().includes(query)) {
            return false;
          }
        }
        
        // Apply other filters
        if (search.filters.categories?.length && 
            !search.filters.categories.includes(t.category || '')) {
          return false;
        }
        
        if (search.filters.accounts?.length && 
            !search.filters.accounts.includes(t.accountId)) {
          return false;
        }
        
        if (search.filters.types?.length && 
            !search.filters.types.includes(t.type as any)) {
          return false;
        }
        
        return true;
      },
      description: `Saved: ${search.query || 'Custom filter'}`,
      isCustom: true,
      ...search.filters
    }));
    
    return [...presetFilters, ...customFilters];
  }, [presetFilters, savedSearches]);

  // Apply filter
  const applyFilter = useCallback((filterId: string) => {
    const filter = allFilters.find(f => f.id === filterId);
    if (filter) {
      setActiveFilter(filterId);
      onFilterChange(filter.filter);
      
      // Update usage count for saved searches
      if (filter.isCustom) {
        setSavedSearches(prev => prev.map(s => 
          s.id === filterId 
            ? { ...s, usageCount: s.usageCount + 1 }
            : s
        ));
      }
    }
  }, [allFilters, onFilterChange]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearchDropdown(false);
    
    if (query.trim()) {
      // Add to recent searches
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s !== query);
        return [query, ...filtered].slice(0, 10); // Keep last 10
      });
    }
    
    // Apply search filter
    const searchFilter = (t: Transaction) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return t.description.toLowerCase().includes(q) ||
             t.category?.toLowerCase().includes(q) ||
             t.notes?.toLowerCase().includes(q) ||
             t.accountId.toLowerCase().includes(q);
    };
    
    onFilterChange(searchFilter);
    if (onSearchChange) {
      onSearchChange(query);
    }
  }, [onFilterChange, onSearchChange]);

  // Save current filter combination
  const saveCurrentFilter = useCallback((name: string) => {
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      query: searchQuery,
      filters: {
        // Save current active filter settings
      },
      createdAt: new Date(),
      usageCount: 0
    };
    
    setSavedSearches(prev => [...prev, newSearch]);
    setShowCustomFilterModal(false);
  }, [searchQuery]);

  // Delete saved search
  const deleteSavedSearch = useCallback((id: string) => {
    setSavedSearches(prev => prev.filter(s => s.id !== id));
    if (activeFilter === id) {
      setActiveFilter(null);
      onFilterChange(() => true);
    }
  }, [activeFilter, onFilterChange]);

  // Get filter statistics
  const getFilterStats = useCallback((filterId: string) => {
    const filter = allFilters.find(f => f.id === filterId);
    if (!filter) return 0;
    return transactions.filter(filter.filter).length;
  }, [allFilters, transactions]);

  // Search suggestions based on data
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions = new Set<string>();
    
    // Get unique descriptions, categories, and merchants
    transactions.forEach(t => {
      if (t.description.toLowerCase().includes(query)) {
        // Extract merchant name (first part of description)
        const merchant = t.description.split(/[\s-]/)[0];
        if (merchant.toLowerCase().includes(query)) {
          suggestions.add(merchant);
        }
      }
      if (t.category?.toLowerCase().includes(query)) {
        suggestions.add(t.category);
      }
    });
    
    return Array.from(suggestions).slice(0, 5);
  }, [searchQuery, transactions]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {presetFilters.slice(0, 5).map(filter => (
          <button
            key={filter.id}
            onClick={() => applyFilter(filter.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap
              transition-all duration-200 min-h-[44px]
              ${activeFilter === filter.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            {filter.icon}
            <span>{filter.name}</span>
            <span className="text-xs opacity-75">
              ({getFilterStats(filter.id)})
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="relative">
          <SearchIcon 
            size={20} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Search transactions..."
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
        
        {/* Search Dropdown */}
        {showSearchDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {/* Search Suggestions */}
            {searchSuggestions.length > 0 && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggestions</p>
                {searchSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            
            {/* Recent Searches */}
            {!searchQuery && recentSearches.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Recent Searches</p>
                  <button
                    onClick={() => {
                      setRecentSearches([]);
                      setShowSearchDropdown(false);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.slice(0, 5).map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(search)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
                  >
                    <ClockIcon size={14} className="text-gray-400" />
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Pills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick Filters
          </h3>
          <div className="flex items-center gap-2">
            {savedSearches.length > 0 && (
              <button
                onClick={() => setShowSavedSearches(!showSavedSearches)}
                className="text-sm text-primary hover:text-secondary transition-colors flex items-center gap-1"
              >
                <StarIcon size={14} />
                Saved ({savedSearches.length})
              </button>
            )}
            {(searchQuery || activeFilter) && (
              <button
                onClick={() => setShowCustomFilterModal(true)}
                className="text-sm text-primary hover:text-secondary transition-colors flex items-center gap-1"
              >
                <PlusIcon size={14} />
                Save Current
              </button>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {allFilters.map(filter => (
            <button
              key={filter.id}
              onClick={() => applyFilter(filter.id)}
              className={`
                group flex items-center gap-2 px-4 py-2 rounded-lg text-sm min-h-[44px]
                transition-all duration-200 relative
                ${activeFilter === filter.id
                  ? 'bg-primary text-white shadow-md transform scale-105'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-sm'
                }
              `}
              title={filter.description}
            >
              {filter.icon}
              <span className="font-medium">{filter.name}</span>
              <span className={`text-xs ${activeFilter === filter.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                ({getFilterStats(filter.id)})
              </span>
              
              {/* Delete button for custom filters */}
              {filter.isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSavedSearch(filter.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <XIcon size={12} />
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Saved Searches Panel */}
      {showSavedSearches && savedSearches.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Saved Searches
          </h4>
          <div className="space-y-2">
            {savedSearches
              .sort((a, b) => b.usageCount - a.usageCount)
              .map(search => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                >
                  <button
                    onClick={() => {
                      handleSearch(search.query);
                      applyFilter(search.id);
                    }}
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    <StarIcon size={16} className="text-yellow-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {search.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {search.query || 'Custom filter'} • Used {search.usageCount} times
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteSavedSearch(search.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Save Filter Modal */}
      {showCustomFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Save Current Filter
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Save your current search "{searchQuery}" and filter settings for quick access later.
            </p>
            <input
              type="text"
              placeholder="Enter filter name..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  saveCurrentFilter(e.currentTarget.value);
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCustomFilterModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Enter filter name..."]') as HTMLInputElement;
                  if (input?.value) {
                    saveCurrentFilter(input.value);
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <SaveIcon size={16} />
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}