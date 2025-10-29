/**
 * useCashFlowForecast Tests
 * Tests for the cash flow forecast hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCashFlowForecast, useSeasonalAnalysis } from '../useCashFlowForecast';
import { AllProviders } from '../../test/testUtils';
import { Decimal } from 'decimal.js';
import type { Transaction, Account } from '../../types';
import type { ForecastResult, RecurringPattern } from '../../services/cashFlowForecastService';

// Mock the AppContext
vi.mock('../../contexts/AppContext', () => ({
  useApp: vi.fn(),
  AppProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the cashFlowForecastService
vi.mock('../../services/cashFlowForecastService', () => ({
  cashFlowForecastService: {
    forecast: vi.fn(),
    analyzeSeasonalTrends: vi.fn(),
    generateProjections: vi.fn(),
  },
}));

import { useApp } from '../../contexts/AppContext';
import { cashFlowForecastService } from '../../services/cashFlowForecastService';

// Mock data
const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Checking',
    type: 'current',
    balance: 5000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-20'),
  },
  {
    id: 'acc-2',
    name: 'Savings',
    type: 'savings',
    balance: 10000,
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
    isReconciled: false,
  },
  {
    id: 'tx-2',
    accountId: 'acc-1',
    amount: 1200,
    type: 'expense',
    category: 'rent',
    description: 'Monthly rent',
    date: new Date('2025-01-01'),
    pending: false,
    isReconciled: false,
  },
];

const mockForecastResult: ForecastResult = {
  projections: [
    {
      date: new Date('2025-02-01'),
      startingBalance: new Decimal(15000),
      endingBalance: new Decimal(16800),
      totalIncome: new Decimal(3000),
      totalExpenses: new Decimal(1200),
      netCashFlow: new Decimal(1800),
      transactions: [],
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
      confidence: 0.95,
      nextOccurrence: new Date('2025-02-15'),
    },
  ],
  currentBalance: new Decimal(15000),
  projectedBalance: new Decimal(25000),
  totalProjectedIncome: new Decimal(18000),
  totalProjectedExpenses: new Decimal(7200),
  monthlyAverageIncome: new Decimal(3000),
  monthlyAverageExpenses: new Decimal(1200),
};

describe('useCashFlowForecast', () => {
  const mockUseApp = useApp as ReturnType<typeof vi.fn>;
  const mockForecast = cashFlowForecastService.forecast as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: mockTransactions,
    } as any);
    mockForecast.mockReturnValue(mockForecastResult);
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
        expect(result.current.forecast).toEqual(mockForecastResult);
      });

      expect(mockForecast).toHaveBeenCalledWith(mockAccounts, mockTransactions, 6);
    });

    it('does not generate forecast when disabled', () => {
      renderHook(() => useCashFlowForecast({ enabled: false }), {
        wrapper: AllProviders,
      });

      expect(mockForecast).not.toHaveBeenCalled();
    });

    it('filters accounts and transactions based on accountIds', async () => {
      const { result } = renderHook(
        () => useCashFlowForecast({ accountIds: ['acc-1'] }),
        {
          wrapper: AllProviders,
        }
      );

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      expect(mockForecast).toHaveBeenCalledWith(
        [mockAccounts[0]], // Only acc-1
        mockTransactions, // Both transactions are from acc-1
        6
      );
    });

    it('allows customizing forecast period', async () => {
      const { result } = renderHook(() => useCashFlowForecast({ months: 12 }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.forecast).toBeDefined();
      });

      expect(mockForecast).toHaveBeenCalledWith(mockAccounts, mockTransactions, 12);
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
        confidence: 1,
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
  const mockUseApp = useApp as ReturnType<typeof vi.fn>;
  const mockAnalyzeSeasonalTrends = cashFlowForecastService.analyzeSeasonalTrends as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
    } as any);
    
    const mockTrends = new Map([
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

    expect(mockAnalyzeSeasonalTrends).toHaveBeenCalledWith(mockTransactions);
  });

  it('does not analyze when disabled', () => {
    renderHook(() => useSeasonalAnalysis(false), {
      wrapper: AllProviders,
    });

    expect(mockAnalyzeSeasonalTrends).not.toHaveBeenCalled();
  });
});