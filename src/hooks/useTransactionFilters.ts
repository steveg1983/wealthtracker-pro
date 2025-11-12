import { useMemo, useCallback } from 'react';
import type { Transaction, Account, Category } from '../types';

interface FilterOptions {
  filterType: 'all' | 'income' | 'expense';
  filterAccountId: string;
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
}

interface SortOptions {
  field: 'date' | 'account' | 'description' | 'category' | 'amount';
  direction: 'asc' | 'desc';
}

// Memoized date parsing to avoid creating new Date objects repeatedly
const parseDate = (() => {
  const cache = new Map<string, number>();
  
  return (dateStr: string | Date): number => {
    const key = dateStr.toString();
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const timestamp = new Date(dateStr).getTime();
    
    // Limit cache size
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    
    cache.set(key, timestamp);
    return timestamp;
  };
})();

export function useTransactionFilters(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  filterOptions: FilterOptions,
  sortOptions: SortOptions
) {
  // Create lookup maps for better performance
  const accountLookup = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach(acc => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(cat => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Memoized category path getter
  const getCategoryPath = useCallback((categoryId: string): string => {
    const category = categoryLookup.get(categoryId);
    if (!category) return categoryId;
    
    if (category.level === 'detail' && category.parentId) {
      const parent = categoryLookup.get(category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    
    return category.name;
  }, [categoryLookup]);

  // Memoized date range checks
  const dateRange = useMemo(() => {
    if (!filterOptions.dateFrom && !filterOptions.dateTo) {
      return null;
    }
    
    const from = filterOptions.dateFrom ? parseDate(filterOptions.dateFrom) : null;
    const to = filterOptions.dateTo ? (() => {
      const toDate = new Date(filterOptions.dateTo);
      toDate.setHours(23, 59, 59, 999);
      return toDate.getTime();
    })() : null;
    
    return { from, to };
  }, [filterOptions.dateFrom, filterOptions.dateTo]);

  // Memoized search query processing
  const searchTerms = useMemo(() => {
    if (!filterOptions.searchQuery) return null;
    return filterOptions.searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  }, [filterOptions.searchQuery]);

  // Sort comparator function
  const sortComparator = useCallback((a: Transaction, b: Transaction): number => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortOptions.field) {
      case 'date':
        aValue = parseDate(a.date);
        bValue = parseDate(b.date);
        break;
        
      case 'account': {
        const accountA = accountLookup.get(a.accountId);
        const accountB = accountLookup.get(b.accountId);
        aValue = accountA?.name || '';
        bValue = accountB?.name || '';
        break;
      }
      
      case 'description':
        aValue = a.description.toLowerCase();
        bValue = b.description.toLowerCase();
        break;
        
      case 'category':
        aValue = getCategoryPath(a.category).toLowerCase();
        bValue = getCategoryPath(b.category).toLowerCase();
        break;
        
      case 'amount':
        aValue = a.amount;
        bValue = b.amount;
        break;
        
      default:
        return 0;
    }

    if (aValue < bValue) return sortOptions.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOptions.direction === 'asc' ? 1 : -1;
    return 0;
  }, [sortOptions.field, sortOptions.direction, accountLookup, getCategoryPath]);

  // Filter predicate function
  const filterPredicate = useCallback((transaction: Transaction): boolean => {
    // Type filter
    if (filterOptions.filterType !== 'all' && transaction.type !== filterOptions.filterType) {
      return false;
    }
    
    // Account filter
    if (filterOptions.filterAccountId && transaction.accountId !== filterOptions.filterAccountId) {
      return false;
    }
    
    // Date range filter
    if (dateRange) {
      const transactionTime = parseDate(transaction.date);
      if (dateRange.from && transactionTime < dateRange.from) return false;
      if (dateRange.to && transactionTime > dateRange.to) return false;
    }
    
    // Search filter
    if (searchTerms) {
      const description = transaction.description.toLowerCase();
      const categoryPath = getCategoryPath(transaction.category).toLowerCase();
      const amount = transaction.amount.toString();
      const account = accountLookup.get(transaction.accountId);
      const accountName = account?.name.toLowerCase() || '';
      
      // Check if all search terms match somewhere
      const matchesAllTerms = searchTerms.every(term => 
        description.includes(term) ||
        categoryPath.includes(term) ||
        amount.includes(term) ||
        accountName.includes(term)
      );
      
      if (!matchesAllTerms) return false;
    }
    
    return true;
  }, [
    filterOptions.filterType,
    filterOptions.filterAccountId,
    dateRange,
    searchTerms,
    getCategoryPath,
    accountLookup
  ]);

  // Filtered and sorted transactions
  const processedTransactions = useMemo(() => {
    // Filter first
    const filtered = transactions.filter(filterPredicate);
    
    // Then sort
    return filtered.sort(sortComparator);
  }, [transactions, filterPredicate, sortComparator]);

  return {
    transactions: processedTransactions,
    getCategoryPath
  };
}