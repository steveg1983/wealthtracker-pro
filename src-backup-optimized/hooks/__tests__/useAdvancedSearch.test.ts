/**
 * useAdvancedSearch Tests
 * Tests for the advanced search hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdvancedSearch } from '../useAdvancedSearch';
import type { Transaction, Account } from '../../types';

// Mock data
const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  accountId: 'acc-1',
  amount: 100,
  type: 'expense',
  category: 'groceries',
  description: 'Test transaction',
  date: new Date('2025-01-15'),
  pending: false,
  isReconciled: false,
  ...overrides,
});

const mockTransactions: Transaction[] = [
  createMockTransaction({
    id: 'tx-1',
    description: 'Grocery shopping',
    category: 'groceries',
    type: 'expense',
    amount: 150,
    date: new Date('2025-01-20'),
    cleared: true,
  }),
  createMockTransaction({
    id: 'tx-2',
    description: 'Salary payment',
    category: 'income',
    type: 'income',
    amount: 3000,
    date: new Date('2025-01-15'),
    cleared: true,
  }),
  createMockTransaction({
    id: 'tx-3',
    description: 'Transfer to savings',
    category: 'transfer',
    type: 'transfer',
    amount: 500,
    date: new Date('2025-01-10'),
    cleared: false,
  }),
  createMockTransaction({
    id: 'tx-4',
    description: 'Coffee shop',
    category: 'dining',
    type: 'expense',
    amount: 5,
    date: new Date('2024-12-15'), // Older than 30 days
    cleared: true,
  }),
  createMockTransaction({
    id: 'tx-5',
    description: 'Random expense',
    category: '', // Uncategorized
    type: 'expense',
    amount: 50,
    date: new Date('2025-01-18'),
    cleared: true,
  }),
];

const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'current',
    balance: 5000,
    institution: 'Big Bank',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-20'),
  },
  {
    id: 'acc-2',
    name: 'Savings Account',
    type: 'savings',
    balance: 10000,
    institution: 'Online Bank',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-20'),
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Income' },
  { id: 'cat-3', name: 'Transfer' },
  { id: 'cat-4', name: 'Dining' },
];

describe('useAdvancedSearch', () => {
  let hookProps: {
    transactions: Transaction[];
    accounts: Account[];
    categories: { id: string; name: string }[];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-21'));
    
    hookProps = {
      transactions: mockTransactions,
      accounts: mockAccounts,
      categories: mockCategories,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('returns initial state with all transactions', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      expect(result.current.searchResults).toEqual(mockTransactions);
      expect(result.current.isSearchActive).toBe(false);
      expect(result.current.quickFilters).toBeInstanceOf(Array);
      expect(result.current.searchStats.total).toBe(5);
      expect(result.current.searchStats.filtered).toBe(5);
    });
  });

  describe('handleSearchResults', () => {
    it('updates search results and activates search', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      const filteredTransactions = [mockTransactions[0], mockTransactions[1]];
      
      act(() => {
        result.current.handleSearchResults(filteredTransactions);
      });

      expect(result.current.searchResults).toEqual(filteredTransactions);
      expect(result.current.isSearchActive).toBe(true);
    });

    it('deactivates search when results match original transactions', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      act(() => {
        result.current.handleSearchResults(mockTransactions);
      });

      expect(result.current.searchResults).toEqual(mockTransactions);
      expect(result.current.isSearchActive).toBe(false);
    });
  });

  describe('resetSearch', () => {
    it('resets search to show all transactions', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      // First apply a filter
      act(() => {
        result.current.handleSearchResults([mockTransactions[0]]);
      });

      expect(result.current.isSearchActive).toBe(true);

      // Reset search
      act(() => {
        result.current.resetSearch();
      });

      expect(result.current.searchResults).toEqual(mockTransactions);
      expect(result.current.isSearchActive).toBe(false);
    });
  });

  describe('quickFilters', () => {
    it('provides predefined quick filters with counts', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      const filters = result.current.quickFilters;
      
      expect(filters).toHaveLength(7);
      expect(filters.find(f => f.id === 'recent')).toMatchObject({
        label: 'Last 30 Days',
        count: 4, // All except tx-4
      });
      expect(filters.find(f => f.id === 'large-expenses')).toMatchObject({
        label: 'Large Expenses (>$100)',
        count: 1, // Only tx-1
      });
      expect(filters.find(f => f.id === 'uncleared')).toMatchObject({
        label: 'Uncleared',
        count: 1, // Only tx-3
      });
      expect(filters.find(f => f.id === 'income')).toMatchObject({
        label: 'Income Only',
        count: 1, // Only tx-2
      });
      expect(filters.find(f => f.id === 'no-category')).toMatchObject({
        label: 'Uncategorized',
        count: 1, // Only tx-5
      });
    });

    it('applies quick filter correctly', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      act(() => {
        result.current.applyQuickFilter('income');
      });

      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchResults[0].id).toBe('tx-2');
      expect(result.current.isSearchActive).toBe(true);
    });

    it('applies recent transactions filter correctly', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      act(() => {
        result.current.applyQuickFilter('recent');
      });

      expect(result.current.searchResults).toHaveLength(4);
      expect(result.current.searchResults.every(t => 
        new Date(t.date) >= new Date('2024-12-22') // 30 days before 2025-01-21
      )).toBe(true);
    });

    it('ignores invalid filter ID', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      const originalResults = result.current.searchResults;

      act(() => {
        result.current.applyQuickFilter('invalid-filter');
      });

      expect(result.current.searchResults).toEqual(originalResults);
      expect(result.current.isSearchActive).toBe(false);
    });
  });

  describe('searchStats', () => {
    it('calculates statistics correctly', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      const stats = result.current.searchStats;
      
      expect(stats.total).toBe(5);
      expect(stats.filtered).toBe(5);
      expect(stats.percentage).toBe(100);
      expect(stats.income).toBe(3000); // Only tx-2
      expect(stats.expenses).toBe(205); // tx-1 (150) + tx-4 (5) + tx-5 (50)
      expect(stats.totalAmount).toBe(3000 - 205 + 500); // Income - expenses + transfers
    });

    it('updates statistics when search is active', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      act(() => {
        result.current.applyQuickFilter('expenses');
      });

      const stats = result.current.searchStats;
      
      expect(stats.filtered).toBe(3); // 3 expense transactions
      expect(stats.percentage).toBe(60); // 3/5 * 100
      expect(stats.income).toBe(0);
      expect(stats.expenses).toBe(205);
      expect(stats.totalAmount).toBe(-205);
    });
  });

  describe('globalSearch', () => {
    it('searches across transactions, accounts, and categories', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      let searchResults;
      act(() => {
        // Search for 'groceries' which is in both transaction and category
        searchResults = result.current.globalSearch('groceries');
      });

      expect(searchResults).toBeDefined();
      const { transactions, accounts, categories } = searchResults!;
      
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('tx-1');
      expect(accounts).toHaveLength(0);
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe('cat-1');
    });

    it('searches account names and institutions', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      let searchResults;
      act(() => {
        searchResults = result.current.globalSearch('bank');
      });

      const { accounts } = searchResults!;
      expect(accounts).toHaveLength(2); // Both accounts match 'bank' in institution
    });

    it('returns empty results for empty query', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      let searchResults;
      act(() => {
        searchResults = result.current.globalSearch('');
      });

      expect(searchResults).toEqual({
        transactions: [],
        accounts: [],
        categories: [],
      });
      expect(result.current.isSearchActive).toBe(false);
    });

    it('performs case-insensitive search', () => {
      const { result } = renderHook(() => useAdvancedSearch(hookProps));

      let searchResults;
      act(() => {
        searchResults = result.current.globalSearch('SALARY');
      });

      const { transactions } = searchResults!;
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('tx-2');
    });

    it('searches transaction notes', () => {
      // Add a transaction with notes
      const transactionWithNotes = createMockTransaction({
        id: 'tx-6',
        description: 'Test',
        notes: 'Important payment for services',
      });
      
      const { result } = renderHook(() => 
        useAdvancedSearch({
          ...hookProps,
          transactions: [...mockTransactions, transactionWithNotes],
        })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.globalSearch('important');
      });

      const { transactions } = searchResults!;
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('tx-6');
    });
  });
});