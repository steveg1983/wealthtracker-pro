/**
 * useCashFlowForecast Tests
 * Tests for the cash flow forecast hook.
 *
 * The hook reads accounts/transactions from the LIVE AppContextSupabase
 * provider module. The real provider hydrates asynchronously via DataService,
 * so — following the house pattern in useGlobalSearch.test.ts — useApp is
 * stubbed on the live module and hands the hook the fixtures below
 * synchronously. The financial engine (cashFlowForecastService) stays mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCashFlowForecast, useSeasonalAnalysis } from '../useCashFlowForecast';
import { AllProviders } from '../../test/testUtils';
import { Decimal } from 'decimal.js';
import type { Transaction, Account } from '../../types';
import type { ForecastResult } from '../../services/cashFlowForecastService';
import type { DecimalInstance } from '../../types/decimal-types';

// Stub useApp on the live provider module. vi.hoisted lets the hoisted
// vi.mock factory reference the shared mock function.
const { mockUseApp } = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
}));

vi.mock('../../contexts/AppContextSupabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/AppContextSupabase')>();
  return {
    ...actual,
    useApp: mockUseApp,
  };
});

// Mock the cashFlowForecastService (the financial engine under the hook)
vi.mock('../../services/cashFlowForecastService', () => ({
  cashFlowForecastService: {
    forecast: vi.fn(),
    analyzeSeasonalTrends: vi.fn(),
    generateProjections: vi.fn(),
  },
}));

import { cashFlowForecastService } from '../../services/cashFlowForecastService';

// Fixture data. Transaction amounts follow the SIGNED convention:
// expenses are negative, income positive.
const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Checking',
    type: 'current',
    balance: 5000,
    currency: 'GBP',
    lastUpdated: new Date('2025-01-20'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-20'),
  },
  {
    id: 'acc-2',
    name: 'Savings',
    type: 'savings',
    balance: 10000,
    currency: 'GBP',
    lastUpdated: new Date('2025-01-20'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-20'),
  },
];

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    accountId: 'acc-1',
    amount: 3000,
    type: 'income',
    category: 'salary',
    description: 'Monthly salary',
    date: new Date('2025-01-15'),
    pending: false,
  },
  {
    id: 'tx-2',
    accountId: 'acc-1',
    amount: -1200,
    type: 'expense',
    category: 'rent',
    description: 'Monthly rent',
    date: new Date('2025-01-01'),
    pending: false,
  },
];

// Factory so each forecast call gets a fresh result object — the hook
// mutates the result in place when merging custom patterns, so a shared
// object would leak state between tests.
const createMockForecastResult = (): ForecastResult => ({
  projections: [
    {
      date: new Date('2025-02-01'),
      projectedBalance: new Decimal(16800),
      projectedIncome: new Decimal(3000),
      projectedExpenses: new Decimal(1200),
      recurringTransactions: [],
      confidence: 90,
    },
  ],
  recurringPatterns: [
    {
      id: 'pattern-1',
      description: 'Monthly salary',
      amount: new Decimal(3000),
      type: 'income',
      category: 'salary',
      frequency: 'monthly',
      confidence: 95,
      lastOccurrence: new Date('2025-01-15'),
      nextOccurrence: new Date('2025-02-15'),
    },
  ],
  summary: {
    averageMonthlyIncome: new Decimal(3000),
    averageMonthlyExpenses: new Decimal(1200),
    averageMonthlySavings: new Decimal(1800),
    projectedEndBalance: new Decimal(25000),
    lowestProjectedBalance: new Decimal(15000),
    lowestBalanceDate: new Date('2025-03-01'),
  },
});

describe('useCashFlowForecast', () => {
  const mockForecast = vi.mocked(cashFlowForecastService.forecast);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: mockTransactions,
    });
    mockForecast.mockImplementation(() => createMockForecastResult());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useCashFlowForecast({ enabled: false }), {
        wrapper: AllProviders,
      });

      expect(result.current.forecast).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.updatePattern).toBe('function');
      expect(typeof result.current.removePattern).toBe('function');
      expect(typeof result.current.addCustomPattern).toBe('function');
    });

    it('generates forecast on mount when enabled', async () => {
      const { result } = renderHook(() => useCashFlowForecast({ enabled: true }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toEqual(createMockForecastResult());
      });

      // Verify the forecast engine received the fixture accounts,
      // fixture transactions, and the default 6-month period
      expect(mockForecast).toHaveBeenCalledWith(mockAccounts, mockTransactions, 6);
    });

    it('does not generate forecast when disabled', () => {
      renderHook(() => useCashFlowForecast({ enabled: false }), {
        wrapper: AllProviders,
      });

      expect(mockForecast).not.toHaveBeenCalled();
    });

    it('filters accounts and transactions based on accountIds', async () => {
      // Stable reference: an inline array literal would be a new reference on
      // every render, which re-fires the hook's forecast effect endlessly.
      const accountIds = ['acc-1'];

      const { result } = renderHook(
        () => useCashFlowForecast({ accountIds }),
        {
          wrapper: AllProviders,
        }
      );

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      // Only acc-1 and its transactions should reach the engine
      expect(mockForecast).toHaveBeenCalled();
      const callArgs = mockForecast.mock.calls[0];
      expect(callArgs[0]).toEqual([mockAccounts[0]]);
      expect(callArgs[1]).toEqual(mockTransactions);
      expect(callArgs[2]).toBe(6); // default period
    });

    it('allows customizing forecast period', async () => {
      const { result } = renderHook(() => useCashFlowForecast({ months: 12 }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      // Verify forecast was called with custom period
      expect(mockForecast).toHaveBeenCalled();
      const callArgs = mockForecast.mock.calls[0];
      expect(callArgs[2]).toBe(12); // custom period
    });
  });

  describe('error handling', () => {
    it('handles forecast generation errors', async () => {
      const errorMessage = 'Failed to generate forecast';
      mockForecast.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const { result } = renderHook(() => useCashFlowForecast(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });

      expect(result.current.forecast).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('refresh functionality', () => {
    it('refreshes forecast on demand', async () => {
      const { result } = renderHook(() => useCashFlowForecast(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      expect(mockForecast).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(mockForecast).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('pattern management', () => {
    it('adds custom pattern', async () => {
      const { result } = renderHook(() => useCashFlowForecast(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      const customPattern = {
        description: 'Custom expense',
        amount: new Decimal(500),
        type: 'expense' as const,
        category: 'custom',
        frequency: 'monthly' as const,
        confidence: 100,
        lastOccurrence: new Date('2025-01-01'),
        nextOccurrence: new Date('2025-02-01'),
      };

      act(() => {
        result.current.addCustomPattern(customPattern);
      });

      // The hook should regenerate forecast with custom pattern
      await waitFor(() => {
        expect(mockForecast).toHaveBeenCalledTimes(2);
      });
    });

    it('updates existing pattern', async () => {
      const { result } = renderHook(() => useCashFlowForecast(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      act(() => {
        result.current.updatePattern('pattern-1', { amount: new Decimal(3500) });
      });

      // Should trigger forecast regeneration
      await waitFor(() => {
        expect(mockForecast).toHaveBeenCalledTimes(2);
      });
    });

    it('removes pattern', async () => {
      const { result } = renderHook(() => useCashFlowForecast(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      act(() => {
        result.current.removePattern('pattern-1');
      });

      // Should trigger forecast regeneration
      await waitFor(() => {
        expect(mockForecast).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('useSeasonalAnalysis', () => {
  const mockAnalyzeSeasonalTrends = vi.mocked(cashFlowForecastService.analyzeSeasonalTrends);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: mockTransactions,
    });

    const mockTrends = new Map<number, { income: DecimalInstance; expenses: DecimalInstance }>([
      [1, { income: new Decimal(3000), expenses: new Decimal(1200) }],
      [2, { income: new Decimal(3000), expenses: new Decimal(1200) }],
    ]);
    mockAnalyzeSeasonalTrends.mockReturnValue(mockTrends);
  });

  it('analyzes seasonal trends when enabled', async () => {
    const { result } = renderHook(() => useSeasonalAnalysis(true), {
      wrapper: AllProviders,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current).toBeInstanceOf(Map);
    });

    // Verify seasonal analysis received the fixture transactions
    expect(mockAnalyzeSeasonalTrends).toHaveBeenCalledWith(mockTransactions);
  });

  it('does not analyze when disabled', () => {
    renderHook(() => useSeasonalAnalysis(false), {
      wrapper: AllProviders,
    });

    expect(mockAnalyzeSeasonalTrends).not.toHaveBeenCalled();
  });
});
