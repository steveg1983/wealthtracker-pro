import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReconciliation } from '../useReconciliation';
import type { Account, Transaction } from '../../types';

// Mock the reconciliation utility
vi.mock('../../utils/reconciliation', () => ({
  getReconciliationSummary: vi.fn()
}));

import { getReconciliationSummary } from '../../utils/reconciliation';

describe('useReconciliation', () => {
  // Sample test data
  const mockAccounts: Account[] = [
    {
      id: 'acc1',
      name: 'Checking Account',
      type: 'current',
      balance: 1000,
      currency: 'USD',
      institution: 'Test Bank',
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'acc2',
      name: 'Savings Account',
      type: 'savings',
      balance: 5000,
      currency: 'USD',
      institution: 'Test Bank',
      lastUpdated: new Date('2024-01-01')
    }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx1',
      date: new Date('2024-01-10'),
      amount: 100,
      description: 'Grocery Store',
      category: 'Food',
      accountId: 'acc1',
      type: 'expense',
      cleared: false
    },
    {
      id: 'tx2',
      date: new Date('2024-01-11'),
      amount: 50,
      description: 'Gas Station',
      category: 'Transportation',
      accountId: 'acc1',
      type: 'expense',
      cleared: true
    },
    {
      id: 'tx3',
      date: new Date('2024-01-12'),
      amount: 200,
      description: 'Online Shopping',
      category: 'Shopping',
      accountId: 'acc2',
      type: 'expense',
      cleared: false
    },
    {
      id: 'tx4',
      date: new Date('2024-01-13'),
      amount: 1000,
      description: 'Salary',
      category: 'Income',
      accountId: 'acc1',
      type: 'income',
      cleared: false
    }
  ];

  const mockReconciliationSummary = [
    {
      account: mockAccounts[0],
      unreconciledCount: 2,
      totalToReconcile: 1100,
      lastImportDate: new Date('2024-01-13')
    },
    {
      account: mockAccounts[1],
      unreconciledCount: 1,
      totalToReconcile: 200,
      lastImportDate: new Date('2024-01-12')
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up the mock implementation
    (getReconciliationSummary as any).mockReturnValue(mockReconciliationSummary);
  });

  describe('reconciliationDetails', () => {
    it('should return reconciliation summary from utility function', () => {
      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, mockTransactions)
      );

      expect(getReconciliationSummary).toHaveBeenCalledWith(mockAccounts, mockTransactions);
      expect(result.current.reconciliationDetails).toEqual(mockReconciliationSummary);
    });

    it('should memoize reconciliation details', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      const firstRender = result.current.reconciliationDetails;
      
      // Re-render with same props
      rerender({ accounts: mockAccounts, transactions: mockTransactions });
      
      expect(result.current.reconciliationDetails).toBe(firstRender);
      expect(getReconciliationSummary).toHaveBeenCalledTimes(1);
    });

    it('should recalculate when accounts change', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      const updatedAccounts = [...mockAccounts, {
        id: 'acc3',
        name: 'New Account',
        type: 'current' as const,
        balance: 0,
        currency: 'USD',
        institution: 'New Bank',
        lastUpdated: new Date()
      }];

      rerender({ accounts: updatedAccounts, transactions: mockTransactions });

      expect(getReconciliationSummary).toHaveBeenCalledTimes(2);
      expect(getReconciliationSummary).toHaveBeenLastCalledWith(updatedAccounts, mockTransactions);
    });

    it('should recalculate when transactions change', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      const updatedTransactions = [...mockTransactions, {
        id: 'tx5',
        date: new Date(),
        amount: 75,
        description: 'New Transaction',
        category: 'Other',
        accountId: 'acc1',
        type: 'expense' as const,
        cleared: false
      }];

      rerender({ accounts: mockAccounts, transactions: updatedTransactions });

      expect(getReconciliationSummary).toHaveBeenCalledTimes(2);
      expect(getReconciliationSummary).toHaveBeenLastCalledWith(mockAccounts, updatedTransactions);
    });
  });

  describe('totalUnreconciledCount', () => {
    it('should count all uncleared transactions', () => {
      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, mockTransactions)
      );

      // tx1, tx3, and tx4 are uncleared (cleared: false)
      expect(result.current.totalUnreconciledCount).toBe(3);
    });

    it('should return 0 when all transactions are cleared', () => {
      const clearedTransactions = mockTransactions.map(tx => ({
        ...tx,
        cleared: true
      }));

      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, clearedTransactions)
      );

      expect(result.current.totalUnreconciledCount).toBe(0);
    });

    it('should return 0 when there are no transactions', () => {
      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, [])
      );

      expect(result.current.totalUnreconciledCount).toBe(0);
    });

    it('should memoize the count', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      const firstCount = result.current.totalUnreconciledCount;
      
      // Re-render with same props
      rerender({ accounts: mockAccounts, transactions: mockTransactions });
      
      expect(result.current.totalUnreconciledCount).toBe(firstCount);
    });

    it('should handle transactions with undefined cleared property', () => {
      const transactionsWithUndefined = [
        ...mockTransactions,
        {
          id: 'tx5',
          date: new Date(),
          amount: 100,
          description: 'No cleared property',
          category: 'Other',
          accountId: 'acc1',
          type: 'expense' as const,
          // cleared property is undefined
        }
      ];

      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, transactionsWithUndefined)
      );

      // Should count transactions where cleared !== true
      expect(result.current.totalUnreconciledCount).toBe(4);
    });
  });

  describe('getUnreconciledCount', () => {
    it('should return count for specific account', () => {
      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, mockTransactions)
      );

      // acc1 has tx1 and tx4 uncleared
      expect(result.current.getUnreconciledCount('acc1')).toBe(2);
      
      // acc2 has tx3 uncleared
      expect(result.current.getUnreconciledCount('acc2')).toBe(1);
    });

    it('should return 0 for account with no transactions', () => {
      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, mockTransactions)
      );

      expect(result.current.getUnreconciledCount('acc3')).toBe(0);
    });

    it('should return 0 for account with all cleared transactions', () => {
      const transactions = [
        {
          id: 'tx1',
          date: new Date(),
          amount: 100,
          description: 'Test',
          category: 'Test',
          accountId: 'acc1',
          type: 'expense' as const,
          cleared: true
        }
      ];

      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, transactions)
      );

      expect(result.current.getUnreconciledCount('acc1')).toBe(0);
    });

    it('should be memoized', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      const firstFunction = result.current.getUnreconciledCount;
      
      // Re-render with same props
      rerender({ accounts: mockAccounts, transactions: mockTransactions });
      
      expect(result.current.getUnreconciledCount).toBe(firstFunction);
    });

    it('should update when transactions change', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      expect(result.current.getUnreconciledCount('acc1')).toBe(2);

      // Clear one transaction
      const updatedTransactions = mockTransactions.map(tx => 
        tx.id === 'tx1' ? { ...tx, cleared: true } : tx
      );

      rerender({ accounts: mockAccounts, transactions: updatedTransactions });

      expect(result.current.getUnreconciledCount('acc1')).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty accounts array', () => {
      // Override mock for this specific test
      (getReconciliationSummary as any).mockReturnValue([]);
      
      const { result } = renderHook(() => 
        useReconciliation([], mockTransactions)
      );

      expect(result.current.reconciliationDetails).toEqual([]);
      expect(result.current.totalUnreconciledCount).toBe(3);
      expect(result.current.getUnreconciledCount('acc1')).toBe(2);
    });

    it('should handle empty transactions array', () => {
      // Override mock for this specific test
      (getReconciliationSummary as any).mockReturnValue([]);
      
      const { result } = renderHook(() => 
        useReconciliation(mockAccounts, [])
      );

      expect(getReconciliationSummary).toHaveBeenCalledWith(mockAccounts, []);
      expect(result.current.totalUnreconciledCount).toBe(0);
      expect(result.current.getUnreconciledCount('acc1')).toBe(0);
    });

    it('should handle both empty arrays', () => {
      // Override mock for this specific test
      (getReconciliationSummary as any).mockReturnValue([]);
      
      const { result } = renderHook(() => 
        useReconciliation([], [])
      );

      expect(result.current.reconciliationDetails).toEqual([]);
      expect(result.current.totalUnreconciledCount).toBe(0);
      expect(result.current.getUnreconciledCount('any-id')).toBe(0);
    });
  });
});