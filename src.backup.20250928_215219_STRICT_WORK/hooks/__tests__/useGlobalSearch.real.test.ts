/**
 * useGlobalSearch REAL Tests
 * Tests global search functionality with real data
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalSearch } from '../useGlobalSearch';

describe('useGlobalSearch - REAL Tests', () => {
  it('searches through real data correctly', () => {
    const { result } = renderHook(() => useGlobalSearch());
    
    // Test with real search scenarios
    const testData = [
      { id: '1', type: 'transaction', description: 'Grocery shopping', amount: -50 },
      { id: '2', type: 'transaction', description: 'Salary payment', amount: 3000 },
      { id: '3', type: 'account', name: 'Savings Account', balance: 10000 },
    ];
    
    act(() => {
      result.current.setSearchData(testData);
      result.current.search('grocery');
    });
    
    const results = result.current.searchResults;
    expect(results).toHaveLength(1);
    expect(results[0].description).toContain('Grocery');
  });
});