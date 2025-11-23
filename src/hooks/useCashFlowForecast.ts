import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { cashFlowForecastService, type ForecastResult, type RecurringPattern } from '../services/cashFlowForecastService';
import type { DecimalInstance } from '../types/decimal-types';

interface UseCashFlowForecastOptions {
  months?: number;
  accountIds?: string[];
  enabled?: boolean;
}

interface UseCashFlowForecastResult {
  forecast: ForecastResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  updatePattern: (patternId: string, updates: Partial<RecurringPattern>) => void;
  removePattern: (patternId: string) => void;
  addCustomPattern: (pattern: Omit<RecurringPattern, 'id'>) => void;
}

export function useCashFlowForecast({
  months = 6,
  accountIds,
  enabled = true
}: UseCashFlowForecastOptions = {}): UseCashFlowForecastResult {
  const { accounts, transactions } = useApp();
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPatterns, setCustomPatterns] = useState<RecurringPattern[]>([]);

  // Filter accounts and transactions if specific accounts are selected
  const filteredData = useMemo(() => {
    let filteredAccounts = accounts;
    let filteredTransactions = transactions;

    if (accountIds && accountIds.length > 0) {
      filteredAccounts = accounts.filter(acc => accountIds.includes(acc.id));
      filteredTransactions = transactions.filter(txn => accountIds.includes(txn.accountId));
    }

    return { accounts: filteredAccounts, transactions: filteredTransactions };
  }, [accounts, transactions, accountIds]);

  const generateForecast = useCallback(() => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = cashFlowForecastService.forecast(
        filteredData.accounts,
        filteredData.transactions,
        months
      );

      // Merge with custom patterns
      if (customPatterns.length > 0) {
        result.recurringPatterns = [...result.recurringPatterns, ...customPatterns];

        // Regenerate projections with custom patterns
        result.projections = cashFlowForecastService['generateProjections'](
          filteredData.accounts,
          filteredData.transactions,
          result.recurringPatterns,
          new Date(),
          new Date(result.projections[result.projections.length - 1]?.date || new Date())
        );
      }

      setForecast(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate forecast');
    } finally {
      setIsLoading(false);
    }
  }, [filteredData.accounts, filteredData.transactions, months, enabled, customPatterns]);

  // Generate forecast when data changes
  useEffect(() => {
    generateForecast();
  }, [generateForecast]);

  const refresh = () => {
    generateForecast();
  };

  const updatePattern = (patternId: string, updates: Partial<RecurringPattern>) => {
    setCustomPatterns(prev => {
      const existing = prev.find(p => p.id === patternId);
      if (existing) {
        return prev.map(p => p.id === patternId ? { ...p, ...updates } : p);
      }
      
      // If not in custom patterns, add it as a custom pattern with updates
      if (forecast) {
        const originalPattern = forecast.recurringPatterns.find(p => p.id === patternId);
        if (originalPattern) {
          return [...prev, { ...originalPattern, ...updates, id: `custom-${patternId}` }];
        }
      }
      
      return prev;
    });
  };

  const removePattern = (patternId: string) => {
    // Add to a removed patterns list or mark as disabled
    setCustomPatterns(prev => {
      const pattern = forecast?.recurringPatterns.find(p => p.id === patternId);
      if (pattern) {
        return [...prev, { ...pattern, confidence: 0, id: `removed-${patternId}` }];
      }
      return prev.filter(p => p.id !== patternId);
    });
  };

  const addCustomPattern = (pattern: Omit<RecurringPattern, 'id'>) => {
    const newPattern: RecurringPattern = {
      ...pattern,
      id: `custom-${Date.now()}-${Math.random()}`
    };
    setCustomPatterns(prev => [...prev, newPattern]);
  };

  return {
    forecast,
    isLoading,
    error,
    refresh,
    updatePattern,
    removePattern,
    addCustomPattern
  };
}

// Hook for seasonal analysis
export function useSeasonalAnalysis(enabled = true) {
  const { transactions } = useApp();
  const [seasonalTrends, setSeasonalTrends] = useState<Map<number, { income: DecimalInstance; expenses: DecimalInstance }> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const trends = cashFlowForecastService.analyzeSeasonalTrends(transactions);
    setSeasonalTrends(trends);
  }, [transactions, enabled]);

  return seasonalTrends;
}