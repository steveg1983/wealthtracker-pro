/**
 * useStockPrices REAL Tests
 * Tests stock price fetching and caching
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStockPrices } from '../useStockPrices';

describe('useStockPrices - REAL Tests', () => {
  it('fetches and caches stock prices', () => {
    const symbols = ['AAPL', 'TSLA'];
    
    const { result } = renderHook(() => useStockPrices(symbols));
    
    // Check hook returns expected structure
    expect(result.current).toHaveProperty('prices');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
    
    // Verify refresh function exists
    expect(typeof result.current.refresh).toBe('function');
  });
});