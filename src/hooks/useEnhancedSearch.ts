import { useState, useEffect, useCallback, useMemo } from 'react';
import { searchService, SearchOptions, SearchResponse } from '../services/searchService';
import type { Transaction, Account, Budget, Goal } from '../types';
import { useDebounce } from './useDebounce';
import { lazyLogger as logger } from '../services/serviceFactory';

interface UseEnhancedSearchProps {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  categories: { id: string; name: string }[];
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  options: SearchOptions;
  createdAt: Date;
}

export function useEnhancedSearch({
  transactions,
  accounts,
  budgets,
  goals,
  categories
}: UseEnhancedSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({});
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse<Transaction> | null>(null);
  const [naturalLanguageMode, setNaturalLanguageMode] = useState(false);
  
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Initialize search indices
  useEffect(() => {
    searchService.initializeIndices({
      transactions,
      accounts,
      budgets,
      goals
    });
  }, [transactions, accounts, budgets, goals]);

  // Load saved searches
  useEffect(() => {
    const saved = localStorage.getItem('enhanced-searches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedSearches(parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt)
        })));
      } catch (error) {
        logger.error('Error loading saved searches:', error);
      }
    }
  }, []);

  // Perform search
  const performSearch = useCallback(async () => {
    setIsSearching(true);
    
    try {
      let options = searchOptions;
      
      // If in natural language mode, parse the query
      if (naturalLanguageMode && debouncedQuery) {
        const parsedOptions = searchService.parseNaturalLanguageQuery(debouncedQuery);
        options = { ...searchOptions, ...parsedOptions };
      } else if (debouncedQuery) {
        options = { ...searchOptions, query: debouncedQuery };
      }
      
      const response = searchService.searchTransactions(transactions, options);
      setSearchResponse(response);
    } catch (error) {
      logger.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [transactions, searchOptions, debouncedQuery, naturalLanguageMode]);

  // Trigger search when query or options change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Update search options
  const updateSearchOptions = useCallback((updates: Partial<SearchOptions>) => {
    setSearchOptions(prev => ({ ...prev, ...updates }));
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchOptions({});
    setSearchResponse(null);
  }, []);

  // Save current search
  const saveSearch = useCallback((name: string) => {
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      query: searchQuery,
      options: searchOptions,
      createdAt: new Date()
    };
    
    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('enhanced-searches', JSON.stringify(updated));
  }, [searchQuery, searchOptions, savedSearches]);

  // Load saved search
  const loadSearch = useCallback((search: SavedSearch) => {
    setSearchQuery(search.query);
    setSearchOptions(search.options);
  }, []);

  // Delete saved search
  const deleteSearch = useCallback((searchId: string) => {
    const updated = savedSearches.filter(s => s.id !== searchId);
    setSavedSearches(updated);
    localStorage.setItem('enhanced-searches', JSON.stringify(updated));
  }, [savedSearches]);

  // Get search suggestions
  const getSuggestions = useCallback((partial: string) => {
    return searchService.getSuggestions(partial, {
      transactions,
      accounts,
      categories
    });
  }, [transactions, accounts, categories]);

  // Search across all entities
  const searchAll = useCallback((query: string) => {
    return searchService.searchAll(query, {
      transactions,
      accounts,
      budgets,
      goals
    });
  }, [transactions, accounts, budgets, goals]);

  // Quick search presets
  const quickSearchPresets = useMemo(() => [
    {
      id: 'recent-large',
      name: 'Recent Large Transactions',
      options: {
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        amountMin: 100,
        sortBy: 'amount' as const,
        sortOrder: 'desc' as const
      }
    },
    {
      id: 'this-month-expenses',
      name: 'This Month\'s Expenses',
      options: {
        ...searchService.parseNaturalLanguageQuery('this month'),
        types: ['expense'] as Array<'expense'>
      }
    },
    {
      id: 'uncategorized',
      name: 'Uncategorized Transactions',
      options: {
        categoryIds: ['', 'other', 'Other']
      }
    },
    {
      id: 'pending',
      name: 'Pending Transactions',
      options: {
        cleared: false
      }
    }
  ], []);

  return {
    // Search state
    searchQuery,
    setSearchQuery,
    searchOptions,
    updateSearchOptions,
    searchResponse,
    isSearching,
    
    // Natural language mode
    naturalLanguageMode,
    setNaturalLanguageMode,
    
    // Actions
    clearSearch,
    performSearch,
    getSuggestions,
    searchAll,
    
    // Saved searches
    savedSearches,
    saveSearch,
    loadSearch,
    deleteSearch,
    
    // Quick presets
    quickSearchPresets,
    
    // Results
    searchResults: searchResponse?.results.map(r => r.item) || [],
    totalResults: searchResponse?.total || 0,
    hasResults: (searchResponse?.total || 0) > 0,
    aggregations: searchResponse?.aggregations
  };
}