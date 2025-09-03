/**
 * useReconciliation REAL Tests
 * Tests transaction reconciliation logic
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReconciliation } from '../useReconciliation';

describe('useReconciliation - REAL Tests', () => {
  it('reconciles real transactions correctly', () => {
    const { result } = renderHook(() => useReconciliation());
    
    // Test with real transaction data
    const transactions = [
      { id: '1', amount: 100, date: '2024-01-01', cleared: false },
      { id: '2', amount: -50, date: '2024-01-02', cleared: false },
      { id: '3', amount: 200, date: '2024-01-03', cleared: true },
    ];
    
    act(() => {
      result.current.setTransactions(transactions);
    });
    
    // Get uncleared transactions
    const uncleared = result.current.unclearedTransactions;
    expect(uncleared).toHaveLength(2);
    
    // Mark as cleared
    act(() => {
      result.current.markAsCleared(['1', '2']);
    });
    
    expect(result.current.unclearedTransactions).toHaveLength(0);
  });
});