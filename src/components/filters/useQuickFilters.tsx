// Converted to .tsx for inline icon JSX
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useLogger } from '../services/ServiceProvider';
import {
  CheckCircleIcon,
  CalendarIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  AlertCircleIcon,
  XIcon,
  StarIcon
} from '../icons';
import type { Transaction } from '../../types';
import type { FilterPreset, SavedSearch } from './types';

export function useQuickFilters(
  onFilterChange: (filter: (transaction: Transaction) => boolean) => void,
  onSearchChange?: (query: string) => void
) {
  const logger = useLogger();
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
        logger.error('Failed to parse saved searches:', e);
      }
    }
    
    const recent = localStorage.getItem('wealthtracker_recentSearches');
    if (recent) {
      try {
        setRecentSearches(JSON.parse(recent));
      } catch (e) {
        logger.error('Failed to parse recent searches:', e);
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
      filter: (t: Transaction) => {
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
      filter: (t: Transaction) => {
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
      filter: (t: Transaction) => {
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
      filter: (t: Transaction) => t.type === 'income',
      description: 'Income transactions only'
    },
    {
      id: 'expenses',
      name: 'Expenses',
      icon: <TrendingDownIcon size={16} />,
      filter: (t: Transaction) => t.type === 'expense',
      description: 'Expense transactions only'
    },
    {
      id: 'large',
      name: 'Large',
      icon: <DollarSignIcon size={16} />,
      filter: (t: Transaction) => Math.abs(t.amount) >= 500,
      description: 'Transactions over $500'
    },
    {
      id: 'uncategorized',
      name: 'Uncategorized',
      icon: <AlertCircleIcon size={16} />,
      filter: (t: Transaction) => !t.category || t.category === '',
      description: 'Need categorization'
    },
    {
      id: 'uncleared',
      name: 'Uncleared',
      icon: <XIcon size={16} />,
      filter: (t: Transaction) => !t.cleared,
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
            !search.filters.types.includes(t.type as 'income' | 'expense' | 'transfer')) {
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
      filters: {},
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
      setActiveFilter('all');
      applyFilter('all');
    }
  }, [activeFilter, applyFilter]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilter('all');
    setSearchQuery('');
    onFilterChange(() => true);
    if (onSearchChange) {
      onSearchChange('');
    }
  }, [onFilterChange, onSearchChange]);

  // Get suggested searches based on transaction data
  const getSuggestedSearches = useCallback((transactions: Transaction[]) => {
    const suggestions = new Set<string>();
    
    // Most frequent descriptions
    const descriptionCounts = new Map<string, number>();
    transactions.forEach(t => {
      const desc = t.description.toLowerCase();
      descriptionCounts.set(desc, (descriptionCounts.get(desc) || 0) + 1);
    });
    
    // Get top 5 descriptions
    Array.from(descriptionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([desc]) => suggestions.add(desc));
    
    return Array.from(suggestions);
  }, []);

  return {
    activeFilter,
    searchQuery,
    showCustomFilterModal,
    savedSearches,
    recentSearches,
    showSavedSearches,
    showSearchDropdown,
    allFilters,
    presetFilters,
    categories,
    accounts,
    setActiveFilter,
    setSearchQuery,
    setShowCustomFilterModal,
    setShowSavedSearches,
    setShowSearchDropdown,
    applyFilter,
    handleSearch,
    saveCurrentFilter,
    deleteSavedSearch,
    clearFilters,
    getSuggestedSearches
  };
}
