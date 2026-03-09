import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReconciliation } from '../useReconciliation';
import type { Account, Transaction } from '../../types';

describe('useReconciliation', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc1',
      name: 'Checking Account',
      type: 'current',
      balance: 1000,
      currency: 'USD',
      institution: 'Test Bank',
      lastUpdated: new Date('2024-01-01'),
      openingBalance: 500,
      bankBalance: 1200,
    },
    {
      id: 'acc2',
      name: 'Savings Account',
      type: 'savings',
      balance: 5000,
      currency: 'USD',
      institution: 'Test Bank',
      lastUpdated: new Date('2024-01-01'),
      openingBalance: 0,
    }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx1',
      date: new Date('2024-01-10'),
      amount: -100,
      description: 'Grocery Store',
      category: 'Food',
      accountId: 'acc1',
      type: 'expense',
      cleared: false
    },
    {
      id: 'tx2',
      date: new Date('2024-01-11'),
      amount: -50,
      description: 'Gas Station',
      category: 'Transportation',
      accountId: 'acc1',
      type: 'expense',
      cleared: true
    },
    {
      id: 'tx3',
      date: new Date('2024-01-12'),
      amount: -200,
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

  describe('reconciliationDetails', () => {
    it('should compute summaries for all accounts', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      expect(result.current.reconciliationDetails).toHaveLength(2);

      const acc1Summary = result.current.reconciliationDetails.find(s => s.account.id === 'acc1');
      expect(acc1Summary).toBeDefined();
      expect(acc1Summary!.unreconciledCount).toBe(2); // tx1, tx4
      expect(acc1Summary!.bankBalance).toBe(1200);
      // accountBalance = openingBalance(500) + (-100) + (-50) + (1000) = 1350
      expect(acc1Summary!.accountBalance).toBe(1350);
      // clearedBalance = openingBalance(500) + (-50) = 450
      expect(acc1Summary!.clearedBalance).toBe(450);
      // difference = bankBalance(1200) - clearedBalance(450) = 750
      expect(acc1Summary!.difference).toBe(750);
    });

    it('should return null bankBalance and difference when not set', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      const acc2Summary = result.current.reconciliationDetails.find(s => s.account.id === 'acc2');
      expect(acc2Summary!.bankBalance).toBeNull();
      expect(acc2Summary!.difference).toBeNull();
    });
  });

  describe('totalUnreconciledCount', () => {
    it('should count all uncleared transactions', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      // tx1, tx3, tx4 are uncleared
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

    it('should handle transactions with undefined cleared property', () => {
      const transactionsWithUndefined = [
        ...mockTransactions,
        {
          id: 'tx5',
          date: new Date(),
          amount: -100,
          description: 'No cleared property',
          category: 'Other',
          accountId: 'acc1',
          type: 'expense' as const,
        }
      ];

      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, transactionsWithUndefined)
      );

      expect(result.current.totalUnreconciledCount).toBe(4);
    });
  });

  describe('getUnreconciledCount', () => {
    it('should return count for specific account', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      expect(result.current.getUnreconciledCount('acc1')).toBe(2);
      expect(result.current.getUnreconciledCount('acc2')).toBe(1);
    });

    it('should return 0 for account with no transactions', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      expect(result.current.getUnreconciledCount('acc3')).toBe(0);
    });

    it('should update when transactions change', () => {
      const { result, rerender } = renderHook(
        ({ accounts, transactions }) => useReconciliation(accounts, transactions),
        {
          initialProps: { accounts: mockAccounts, transactions: mockTransactions }
        }
      );

      expect(result.current.getUnreconciledCount('acc1')).toBe(2);

      const updatedTransactions = mockTransactions.map(tx =>
        tx.id === 'tx1' ? { ...tx, cleared: true } : tx
      );

      rerender({ accounts: mockAccounts, transactions: updatedTransactions });

      expect(result.current.getUnreconciledCount('acc1')).toBe(1);
    });
  });

  describe('computeAccountBalance', () => {
    it('should compute balance from opening balance + all transactions', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      // acc1: openingBalance(500) + (-100) + (-50) + (1000) = 1350
      expect(result.current.computeAccountBalance('acc1')).toBe(1350);
      // acc2: openingBalance(0) + (-200) = -200
      expect(result.current.computeAccountBalance('acc2')).toBe(-200);
    });
  });

  describe('computeClearedBalance', () => {
    it('should compute balance from opening balance + cleared transactions only', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, mockTransactions)
      );

      // acc1: openingBalance(500) + (-50) = 450 (only tx2 is cleared)
      expect(result.current.computeClearedBalance('acc1')).toBe(450);
      // acc2: openingBalance(0) + 0 = 0 (no cleared transactions)
      expect(result.current.computeClearedBalance('acc2')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty accounts array', () => {
      const { result } = renderHook(() =>
        useReconciliation([], mockTransactions)
      );

      expect(result.current.reconciliationDetails).toEqual([]);
      expect(result.current.totalUnreconciledCount).toBe(3);
    });

    it('should handle empty transactions array', () => {
      const { result } = renderHook(() =>
        useReconciliation(mockAccounts, [])
      );

      expect(result.current.reconciliationDetails).toHaveLength(2);
      expect(result.current.totalUnreconciledCount).toBe(0);
      expect(result.current.getUnreconciledCount('acc1')).toBe(0);
    });

    it('should handle both empty arrays', () => {
      const { result } = renderHook(() =>
        useReconciliation([], [])
      );

      expect(result.current.reconciliationDetails).toEqual([]);
      expect(result.current.totalUnreconciledCount).toBe(0);
      expect(result.current.getUnreconciledCount('any-id')).toBe(0);
    });
  });
});
