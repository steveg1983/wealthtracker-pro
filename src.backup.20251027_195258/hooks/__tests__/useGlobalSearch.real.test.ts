/**
 * useGlobalSearch REAL Tests
 * Tests global search functionality with real data
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AppContext } from '@/contexts/AppContextSupabase.context';
import type { AppContextType } from '@/contexts/AppContextSupabase.types';
import type { Account, Transaction, Budget, Goal, Category } from '@/types';
import { useGlobalSearch } from '../useGlobalSearch';

describe('useGlobalSearch - REAL Tests', () => {
  it('searches through real data correctly', () => {
    const accounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Savings Account',
        type: 'savings',
        balance: 10000,
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'txn-1',
        accountId: 'acc-1',
        amount: -50,
        type: 'expense',
        category: 'cat-1',
        description: 'Grocery shopping',
        date: new Date('2025-01-10'),
        cleared: false,
      },
      {
        id: 'txn-2',
        accountId: 'acc-1',
        amount: 3000,
        type: 'income',
        category: 'cat-2',
        description: 'Salary payment',
        date: new Date('2025-01-05'),
        cleared: true,
      },
    ];

    const budgets: Budget[] = [
      {
        id: 'budget-1',
        categoryId: 'cat-1',
        amount: 500,
        period: 'monthly',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        spent: 250,
      },
    ];

    const goals: Goal[] = [
      {
        id: 'goal-1',
        name: 'Emergency Fund',
        type: 'savings',
        targetAmount: 5000,
        currentAmount: 1500,
        targetDate: new Date('2026-01-01'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const categories: Category[] = [
      {
        id: 'cat-1',
        name: 'Groceries',
        type: 'expense',
        level: 'detail',
        parentId: null,
        color: '#4ade80',
        isSystem: false,
        isActive: true,
      },
      {
        id: 'cat-2',
        name: 'Salary',
        type: 'income',
        level: 'detail',
        parentId: null,
        color: '#60a5fa',
        isSystem: false,
        isActive: true,
      },
    ];

    const noopAsync = vi.fn(async () => {});
    const noop = vi.fn();

    const mockContext: AppContextType = {
      accounts,
      transactions,
      budgets,
      goals,
      categories,
      tags: [],
      recurringTransactions: [],
      investments: [],
      addAccount: vi.fn(async () => accounts[0]),
      updateAccount: vi.fn(async () => accounts[0]),
      deleteAccount: noopAsync,
      addTransaction: vi.fn(async () => transactions[0]),
      updateTransaction: vi.fn(async () => transactions[0]),
      deleteTransaction: noopAsync,
      addBudget: vi.fn(async () => budgets[0]),
      updateBudget: vi.fn(async () => budgets[0]),
      deleteBudget: noopAsync,
      addGoal: vi.fn(async () => goals[0]),
      updateGoal: vi.fn(async () => goals[0]),
      deleteGoal: noopAsync,
      contributeToGoal: vi.fn(async () => goals[0]),
      addCategory: noop,
      updateCategory: noop,
      deleteCategory: noop,
      getSubCategories: () => [],
      getDetailCategories: () => [],
      addTag: noop,
      updateTag: noop,
      deleteTag: noop,
      getTagUsageCount: () => 0,
      getAllUsedTags: () => [],
      addRecurringTransaction: vi.fn(() => ({
        id: 'rec-1',
        description: '',
        amount: 0,
        type: 'expense',
        category: 'cat-1',
        accountId: 'acc-1',
        frequency: 'monthly',
        interval: 1,
        startDate: new Date(),
        nextDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      updateRecurringTransaction: vi.fn(() => undefined),
      deleteRecurringTransaction: noop,
      importData: noop,
      exportData: () => ({
        accounts,
        transactions,
        budgets,
        goals,
        categories,
        tags: [],
        recurringTransactions: [],
        investments: [],
      }),
      clearAllData: noop,
      refreshData: async () => {},
      getDecimalTransactions: () => [],
      getDecimalAccounts: () => [],
      getDecimalGoals: () => [],
      isLoading: false,
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      isUsingSupabase: false,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AppContext.Provider, { value: mockContext }, children);

    const { result } = renderHook(() => useGlobalSearch('grocery'), { wrapper });

    expect(result.current.hasResults).toBe(true);
    expect(result.current.resultCount).toBeGreaterThan(0);
    const firstResult = result.current.results[0];
    expect(firstResult.matches).toContain('grocery');
    expect(firstResult.type).toBe('transaction');
  });
});
