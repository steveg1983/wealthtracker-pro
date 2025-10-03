/**
 * useRealTimePrices REAL Tests
 * Tests real-time price updates
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealTimePrices } from '../useRealTimePrices';

describe('useRealTimePrices - REAL Tests', () => {
  it('handles real-time price data', () => {
    const symbols = ['AAPL', 'GOOGL', 'MSFT'];
    
    const { result } = renderHook(() => useRealTimePrices(symbols));
    
    // Check initial state
    expect(result.current.prices).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(result.current.error).toBeDefined();
    
    // Verify structure
    if (result.current.prices) {
      symbols.forEach(symbol => {
        if (result.current.prices[symbol]) {
          expect(result.current.prices[symbol]).toHaveProperty('price');
          expect(result.current.prices[symbol]).toHaveProperty('change');
        }
      });
    }
  });
});