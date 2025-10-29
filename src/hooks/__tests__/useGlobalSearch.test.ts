/**
 * useGlobalSearch Tests  
 * Tests for the useGlobalSearch hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalSearch } from '../useGlobalSearch';
import { AllProviders } from '../../test/testUtils';
import type { Account, Transaction, Budget, Goal, Category } from '../../types';

// Mock the useApp hook
const mockAccounts: Account[] = [
  {
    id: 'acc1',
    name: 'Test Checking Account',
    type: 'current',
    balance: 1000,
    currency: 'GBP',
    institution: 'Test Bank',
    lastUpdated: new Date()
  }
];

const mockTransactions: Transaction[] = [
  {
    id: 'tx1',
    description: 'Test Transaction',
    amount: 50,
    type: 'expense',
    category: 'cat1',
    accountId: 'acc1',
    date: new Date(),
    cleared: true
  }
];

const mockBudgets: Budget[] = [
  {
    id: 'budget1',
    category: 'cat1',
    amount: 500,
    period: 'monthly'
  }
];

const mockGoals: Goal[] = [
  {
    id: 'goal1',
    name: 'Test Goal',
    type: 'savings',
    targetAmount: 10000,
    currentAmount: 2000,
    targetDate: new Date('2025-12-31')
  }
];

const mockCategories: Category[] = [
  {
    id: 'cat1',
    name: 'Test Category',
    icon: '🛒'
  }
];

vi.mock('../../contexts/AppContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useApp: () => ({
      accounts: mockAccounts,
      transactions: mockTransactions,
      budgets: mockBudgets,
      goals: mockGoals,
      categories: mockCategories
    })
  };
});

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useGlobalSearch(''), {
        wrapper: AllProviders
      });

      expect(result.current).toMatchObject({
        results: [],
        hasResults: false,
        resultCount: 0
      });
    });

    it('returns empty results for short queries', () => {
      const { result } = renderHook(() => useGlobalSearch('a'), {
        wrapper: AllProviders
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
      expect(result.current.resultCount).toBe(0);
    });
  });

  describe('search functionality', () => {
    it('performs search correctly', () => {
      const { result } = renderHook(() => useGlobalSearch('test'), {
        wrapper: AllProviders
      });

      expect(result.current.hasResults).toBe(true);
      expect(result.current.resultCount).toBeGreaterThan(0);
      expect(result.current.results[0]).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        type: expect.stringMatching(/account|transaction|budget|goal|category/),
        score: expect.any(Number)
      });
    });

    it('searches accounts', () => {
      const { result } = renderHook(() => useGlobalSearch('checking'), {
        wrapper: AllProviders
      });

      expect(result.current.hasResults).toBe(true);
      const accountResult = result.current.results.find(r => r.type === 'account');
      expect(accountResult).toBeDefined();
      expect(accountResult?.title).toContain('Checking');
    });

    it('searches transactions', () => {
      const { result } = renderHook(() => useGlobalSearch('transaction'), {
        wrapper: AllProviders
      });

      expect(result.current.hasResults).toBe(true);
      const transactionResult = result.current.results.find(r => r.type === 'transaction');
      expect(transactionResult).toBeDefined();
    });

    it('searches budgets', () => {
      const { result } = renderHook(() => useGlobalSearch('category'), {
        wrapper: AllProviders
      });

      expect(result.current.hasResults).toBe(true);
      const budgetResult = result.current.results.find(r => r.type === 'budget');
      expect(budgetResult).toBeDefined();
    });

    it('searches goals', () => {
      const { result } = renderHook(() => useGlobalSearch('goal'), {
        wrapper: AllProviders
      });

      expect(result.current.hasResults).toBe(true);
      const goalResult = result.current.results.find(r => r.type === 'goal');
      expect(goalResult).toBeDefined();
      expect(goalResult?.title).toContain('Goal');
    });
  });

  describe('scoring and sorting', () => {
    it('sorts results by score', () => {
      const { result } = renderHook(() => useGlobalSearch('test'), {
        wrapper: AllProviders
      });

      if (result.current.results.length > 1) {
        // Check that results are sorted by score descending
        for (let i = 0; i < result.current.results.length - 1; i++) {
          expect(result.current.results[i].score).toBeGreaterThanOrEqual(
            result.current.results[i + 1].score
          );
        }
      }
    });

    it('includes match information', () => {
      const { result } = renderHook(() => useGlobalSearch('test'), {
        wrapper: AllProviders
      });

      if (result.current.hasResults) {
        expect(result.current.results[0]).toHaveProperty('matches');
        expect(Array.isArray(result.current.results[0].matches)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('handles empty query', () => {
      const { result } = renderHook(() => useGlobalSearch(''), {
        wrapper: AllProviders
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
      expect(result.current.resultCount).toBe(0);
    });

    it('handles query with only spaces', () => {
      const { result } = renderHook(() => useGlobalSearch('   '), {
        wrapper: AllProviders
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
    });

    it('handles query with no matches', () => {
      const { result } = renderHook(() => useGlobalSearch('nonexistentquery12345'), {
        wrapper: AllProviders
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
      expect(result.current.resultCount).toBe(0);
    });
  });
});