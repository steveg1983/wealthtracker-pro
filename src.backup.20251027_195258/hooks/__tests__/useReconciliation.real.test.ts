/**
 * useReconciliation REAL Tests
 * Tests transaction reconciliation logic
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReconciliation } from '../useReconciliation';
import type { Account, Transaction } from '@/types';

describe('useReconciliation - REAL Tests', () => {
  it('reconciles real transactions correctly', () => {
    const accounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Checking',
        type: 'current',
        balance: 1000,
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'txn-1',
        accountId: 'acc-1',
        amount: 200,
        type: 'income',
        description: 'Salary',
        category: 'income',
        date: new Date('2025-01-01'),
        cleared: true,
      },
      {
        id: 'txn-2',
        accountId: 'acc-1',
        amount: 50,
        type: 'expense',
        description: 'Groceries',
        category: 'groceries',
        date: new Date('2025-01-02'),
        cleared: false,
      },
      {
        id: 'txn-3',
        accountId: 'acc-1',
        amount: 30,
        type: 'expense',
        description: 'Transport',
        category: 'transport',
        date: new Date('2025-01-03'),
        cleared: false,
      },
    ];

    const { result } = renderHook(() => useReconciliation(accounts, transactions));

    expect(result.current.totalUnreconciledCount).toBe(2);
    expect(result.current.reconciliationDetails[0].unreconciledCount).toBe(2);
    expect(result.current.getUnreconciledCount('acc-1')).toBe(2);
  });
});
