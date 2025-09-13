/**
 * Custom Hook for Category Transactions
 * Manages category transaction filtering and state
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { categoryTransactionsModalService } from '../services/categoryTransactionsModalService';
import type { TransactionFilter, FilterOptions } from '../services/categoryTransactionsModalService';
import type { Transaction } from '../types';

export interface UseCategoryTransactionsReturn {
  filteredTransactions: Transaction[];
  filterOptions: FilterOptions;
  debouncedSearchQuery: string;
  summary: {
    count: number;
    total: number;
    average: number;
    income: number;
    expense: number;
  };
  hasActiveFilters: boolean;
  updateFilter: <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => void;
  clearFilters: () => void;
  getAccountName: (transaction: Transaction) => string;
}

export function useCategoryTransactions(
  categoryId: string,
  categoryName: string
): UseCategoryTransactionsReturn {
  const { transactions, accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(
    categoryTransactionsModalService.getInitialFilterOptions()
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(filterOptions.searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterOptions.searchQuery]);

  // Get category transactions
  const categoryTransactions = useMemo(() => {
    return categoryTransactionsModalService.filterByCategory(transactions, categoryId);
  }, [transactions, categoryId]);

  // Apply all filters
  const filteredTransactions = useMemo(() => {
    let filtered = categoryTransactions;
    
    // Apply type filter
    filtered = categoryTransactionsModalService.applyTypeFilter(
      filtered,
      filterOptions.transactionFilter
    );
    
    // Apply date filter
    filtered = categoryTransactionsModalService.applyDateFilter(
      filtered,
      filterOptions.fromDate,
      filterOptions.toDate
    );
    
    // Apply search filter
    filtered = categoryTransactionsModalService.applySearchFilter(
      filtered,
      debouncedSearchQuery,
      accounts,
      categoryName,
      formatCurrency
    );
    
    // Sort by date (newest first)
    return categoryTransactionsModalService.sortTransactions(filtered);
  }, [
    categoryTransactions,
    filterOptions.transactionFilter,
    filterOptions.fromDate,
    filterOptions.toDate,
    debouncedSearchQuery,
    accounts,
    categoryName,
    formatCurrency
  ]);

  // Calculate summary
  const summary = useMemo(() => {
    return categoryTransactionsModalService.calculateSummary(filteredTransactions);
  }, [filteredTransactions]);

  // Check for active filters
  const hasActiveFilters = useMemo(() => {
    return categoryTransactionsModalService.hasActiveFilters(filterOptions);
  }, [filterOptions]);

  // Update single filter
  const updateFilter = useCallback(<K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K]
  ) => {
    setFilterOptions(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterOptions(categoryTransactionsModalService.clearFilters());
  }, []);

  // Get account name for transaction
  const getAccountName = useCallback((transaction: Transaction) => {
    return categoryTransactionsModalService.getAccountName(transaction, accounts);
  }, [accounts]);

  return {
    filteredTransactions,
    filterOptions,
    debouncedSearchQuery,
    summary,
    hasActiveFilters,
    updateFilter,
    clearFilters,
    getAccountName
  };
}