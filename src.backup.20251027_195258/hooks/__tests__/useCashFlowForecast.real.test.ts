/**
 * useCashFlowForecast REAL Tests
 * Tests cash flow forecasting with real calculations
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AppContext } from '@/contexts/AppContextSupabase.context';
import type { AppContextType } from '@/contexts/AppContextSupabase.types';
import type { Account, Transaction } from '@/types';
import { useCashFlowForecast } from '../useCashFlowForecast';

describe('useCashFlowForecast - REAL Tests', () => {
  it('calculates real cash flow forecasts', async () => {
    const accounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Checking',
        type: 'current',
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
        amount: 5000,
        type: 'income',
        description: 'Salary',
        category: 'income',
        date: new Date('2025-01-01'),
        cleared: true,
      },
      {
        id: 'txn-2',
        accountId: 'acc-1',
        amount: 3500,
        type: 'expense',
        description: 'Monthly Expenses',
        category: 'expenses',
        date: new Date('2025-01-02'),
        cleared: true,
      },
    ];

    const mockContext: AppContextType = {
      accounts,
      transactions,
      budgets: [],
      goals: [],
      categories: [],
      tags: [],
      recurringTransactions: [],
      investments: [],
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      addBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn(),
      addGoal: vi.fn(),
      updateGoal: vi.fn(),
      deleteGoal: vi.fn(),
      contributeToGoal: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      getSubCategories: vi.fn().mockReturnValue([]),
      getDetailCategories: vi.fn().mockReturnValue([]),
      addTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
      getTagUsageCount: vi.fn().mockReturnValue(0),
      getAllUsedTags: vi.fn().mockReturnValue([]),
      addRecurringTransaction: vi.fn(),
      updateRecurringTransaction: vi.fn(),
      deleteRecurringTransaction: vi.fn(),
      importData: vi.fn(),
      exportData: vi.fn().mockReturnValue({
        accounts,
        transactions,
        budgets: [],
        goals: [],
        categories: [],
        tags: [],
        recurringTransactions: [],
        investments: [],
      }),
      clearAllData: vi.fn(),
      refreshData: vi.fn(),
      getDecimalTransactions: vi.fn().mockReturnValue([]),
      getDecimalAccounts: vi.fn().mockReturnValue([]),
      getDecimalGoals: vi.fn().mockReturnValue([]),
      isLoading: false,
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      isUsingSupabase: false,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AppContext.Provider, { value: mockContext }, children);

    const { result } = renderHook(() => useCashFlowForecast(), { wrapper });

    await waitFor(() => {
      expect(result.current.forecast).not.toBeNull();
    });

    const forecast = result.current.forecast;
    expect(forecast?.summary.averageMonthlySavings.toNumber()).toBeTypeOf('number');
    expect(forecast?.summary.projectedEndBalance.toNumber()).toBeGreaterThan(0);
    expect(forecast?.projections.length).toBeGreaterThan(0);
  });
});
