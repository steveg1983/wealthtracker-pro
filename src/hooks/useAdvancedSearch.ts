import { useState, useCallback, useMemo } from 'react';
import type { Transaction, Account } from '../types';

interface UseAdvancedSearchProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: { id: string; name: string }[];
}

interface QuickFilter {
  id: string;
  label: string;
  filter: (transactions: Transaction[]) => Transaction[];
  count?: number;
}

interface UseAdvancedSearchReturn {
  searchResults: Transaction[];
  isSearchActive: boolean;
  handleSearchResults: (results: Transaction[]) => void;
  resetSearch: () => void;
  quickFilters: QuickFilter[];
  applyQuickFilter: (filterId: string) => void;
  searchStats: {
    total: number;
    filtered: number;
    percentage: number;
    totalAmount: number;
    income: number;
    expenses: number;
  };
  globalSearch: (query: string) => {
    transactions: Transaction[];
    accounts: Account[];
    categories: { id: string; name: string }[];
  };
}

export function useAdvancedSearch({ transactions, accounts, categories }: UseAdvancedSearchProps): UseAdvancedSearchReturn {
  const [searchResults, setSearchResults] = useState<Transaction[]>(transactions);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Handle search results from AdvancedSearch component
  const handleSearchResults = useCallback((results: Transaction[]) => {
    setSearchResults(results);
    setIsSearchActive(results.length !== transactions.length || results.some((r, i) => r.id !== transactions[i]?.id));
  }, [transactions]);

  // Reset search to show all transactions
  const resetSearch = useCallback(() => {
    setSearchResults(transactions);
    setIsSearchActive(false);
  }, [transactions]);

  // Quick filters for common searches
  const quickFilters: QuickFilter[] = useMemo(() => {
    const filters = [
      {
        id: 'recent',
        label: 'Last 30 Days',
        filter: (txns: Transaction[]) => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return txns.filter(t => new Date(t.date) >= thirtyDaysAgo);
        }
      },
      {
        id: 'large-expenses',
        label: 'Large Expenses (>$100)',
        filter: (txns: Transaction[]) => 
          txns.filter(t => t.type === 'expense' && t.amount > 100)
      },
      {
        id: 'uncleared',
        label: 'Uncleared',
        filter: (txns: Transaction[]) => 
          txns.filter(t => !t.cleared)
      },
      {
        id: 'income',
        label: 'Income Only',
        filter: (txns: Transaction[]) => 
          txns.filter(t => t.type === 'income')
      },
      {
        id: 'expenses',
        label: 'Expenses Only',
        filter: (txns: Transaction[]) => 
          txns.filter(t => t.type === 'expense')
      },
      {
        id: 'transfers',
        label: 'Transfers',
        filter: (txns: Transaction[]) => 
          txns.filter(t => t.type === 'transfer')
      },
      {
        id: 'no-category',
        label: 'Uncategorized',
        filter: (txns: Transaction[]) => 
          txns.filter(t => !t.category || t.category === 'Other' || t.category === '')
      }
    ];

    // Add count to each filter
    return filters.map(filter => ({
      ...filter,
      count: filter.filter(transactions).length
    }));
  }, [transactions]);

  // Apply quick filter
  const applyQuickFilter = useCallback((filterId: string) => {
    const filter = quickFilters.find(f => f.id === filterId);
    if (filter) {
      const results = filter.filter(transactions);
      setSearchResults(results);
      setIsSearchActive(true);
    }
  }, [quickFilters, transactions]);

  // Search statistics
  const searchStats = useMemo(() => {
    const total = transactions.length;
    const filtered = searchResults.length;
    const totalAmount = searchResults.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0);
    const income = searchResults.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = searchResults.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return {
      total,
      filtered,
      percentage: total > 0 ? Math.round((filtered / total) * 100) : 0,
      totalAmount,
      income,
      expenses
    };
  }, [transactions, searchResults]);

  // Global search function for searching across all data types
  const globalSearch = useCallback((query: string) => {
    if (!query.trim()) {
      resetSearch();
      return {
        transactions: [],
        accounts: [],
        categories: []
      };
    }

    const lowerQuery = query.toLowerCase();

    // Search transactions
    const matchingTransactions = transactions.filter(t =>
      t.description.toLowerCase().includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery) ||
      t.notes?.toLowerCase().includes(lowerQuery)
    );

    // Search accounts
    const matchingAccounts = accounts.filter(a =>
      a.name.toLowerCase().includes(lowerQuery) ||
      a.institution?.toLowerCase().includes(lowerQuery) ||
      a.type.toLowerCase().includes(lowerQuery)
    );

    // Search categories
    const matchingCategories = categories.filter(c =>
      c.name.toLowerCase().includes(lowerQuery)
    );

    // Update search results with matching transactions
    setSearchResults(matchingTransactions);
    setIsSearchActive(matchingTransactions.length !== transactions.length);

    return {
      transactions: matchingTransactions,
      accounts: matchingAccounts,
      categories: matchingCategories
    };
  }, [transactions, accounts, categories, resetSearch]);

  return {
    searchResults,
    isSearchActive,
    handleSearchResults,
    resetSearch,
    quickFilters,
    applyQuickFilter,
    searchStats,
    globalSearch
  };
}