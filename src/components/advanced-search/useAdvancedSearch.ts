import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { logger } from '../../services/loggingService';
import type { SearchFilter, SavedSearch } from './types';
import type { Transaction, Account } from '../../types';
import { createDefaultFilters } from './types';

export function useAdvancedSearch(
  transactions: Transaction[],
  accounts: Account[],
  categories: { id: string; name: string }[],
  onResults: (results: Transaction[]) => void
) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>(() => 
    createDefaultFilters(categories, accounts)
  );

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('advanced-searches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const searches = parsed.map((search: Omit<SavedSearch, 'createdAt'> & { createdAt: string }) => ({
          ...search,
          createdAt: new Date(search.createdAt)
        }));
        setSavedSearches(searches);
      } catch (error) {
        logger.error('Error loading saved searches:', error);
      }
    }
  }, []);

  const saveToLocalStorage = useCallback((searches: SavedSearch[]) => {
    localStorage.setItem('advanced-searches', JSON.stringify(searches));
  }, []);

  const updateFilter = useCallback((filterId: string, value: string | string[] | number | boolean | null) => {
    setFilters(prev => prev.map(filter => (
      filter.id === filterId 
        ? ({ id: filter.id, label: filter.label, type: filter.type, field: filter.field, value, ...(filter.options ? { options: filter.options } : {}) }) 
        : filter
    )));
  }, []);

  const applyFilters = useCallback((transactions: Transaction[], filters: SearchFilter[]): Transaction[] => {
    let results = transactions;

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
            toDate.setHours(23, 59, 59, 999);
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
  }, []);

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
    results = applyFilters(results, filters);
    return results;
  }, [transactions, accounts, debouncedSearchTerm, filters, applyFilters]);

  useEffect(() => {
    onResults(filteredTransactions);
  }, [filteredTransactions, onResults]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters(prev => prev.map(filter => ({
      ...filter,
      value: Array.isArray(filter.value) ? [] : ''
    })));
  }, []);

  const saveCurrentSearch = useCallback(() => {
    if (!searchName.trim()) return;

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      filters: filters
        .filter(f => f.value && f.value !== '' && (!Array.isArray(f.value) || f.value.length > 0))
        .map(f => ({
          id: String(f.id),
          label: String(f.label),
          type: f.type,
          field: String(f.field),
          value: f.value,
          ...(f.options ? { options: f.options } : {})
        })),
      createdAt: new Date()
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    saveToLocalStorage(updated);
    setSearchName('');
    setShowSavedSearches(false);
  }, [searchName, filters, savedSearches, saveToLocalStorage]);

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

  return {
    isExpanded,
    setIsExpanded,
    searchTerm,
    setSearchTerm,
    showSavedSearches,
    setShowSavedSearches,
    savedSearches,
    searchName,
    setSearchName,
    filters,
    filteredTransactions,
    updateFilter,
    clearFilters,
    saveCurrentSearch,
    loadSavedSearch,
    deleteSavedSearch,
    hasActiveFilters
  };
}
