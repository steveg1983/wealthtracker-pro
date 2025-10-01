/**
 * useCashFlowForecast REAL Tests
 * Tests cash flow forecasting with real calculations
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCashFlowForecast } from '../useCashFlowForecast';

describe('useCashFlowForecast - REAL Tests', () => {
  it('calculates real cash flow forecasts', () => {
    const { result } = renderHook(() => useCashFlowForecast());
    
    // Test with real financial data
    const testData = {
      currentBalance: 10000,
      monthlyIncome: 5000,
      monthlyExpenses: 3500,
      months: 12,
    };
    
    const forecast = result.current.calculateForecast(testData);
    
    expect(forecast).toBeDefined();
    expect(forecast.projectedBalance).toBe(28000); // 10000 + (5000-3500)*12
    expect(forecast.monthlyNetFlow).toBe(1500);
  });
});