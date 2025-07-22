/**
 * TransactionContext Tests
 * Comprehensive tests for the transaction context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { TransactionProvider, useTransactions } from './TransactionContext';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock uuid
const mockUuidV4 = vi.fn(() => 'mock-uuid-123');
vi.mock('uuid', () => ({
  v4: () => mockUuidV4(),
}));

// Mock console.error
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('TransactionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.setItem.mockImplementation(() => {}); // Reset to no-op
    mockUuidV4.mockReturnValue('mock-uuid-123');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <TransactionProvider>{children}</TransactionProvider>
  );

  const wrapperWithInitial = (
    initialTransactions: any[] = [],
    initialRecurringTransactions: any[] = []
  ) => ({ children }: { children: ReactNode }) => (
    <TransactionProvider
      initialTransactions={initialTransactions}
      initialRecurringTransactions={initialRecurringTransactions}
    >
      {children}
    </TransactionProvider>
  );

  const createMockTransaction = (overrides = {}) => ({
    date: new Date('2025-01-20'),
    description: 'Test Transaction',
    amount: 100.50,
    type: 'expense' as const,
    category: 'test-category',
    accountId: 'account-1',
    ...overrides,
  });

  const createMockRecurringTransaction = (overrides = {}) => ({
    description: 'Monthly Rent',
    amount: 1500,
    type: 'expense' as const,
    category: 'housing',
    accountId: 'account-1',
    frequency: 'monthly' as const,
    startDate: '2025-01-01',
    ...overrides,
  });

  describe('initialization', () => {
    it('provides empty arrays when localStorage is empty', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      expect(result.current.transactions).toEqual([]);
      expect(result.current.recurringTransactions).toEqual([]);
    });

    it('loads transactions from localStorage', () => {
      const savedTransactions = [
        {
          id: 'saved-1',
          date: '2025-01-15T00:00:00.000Z',
          description: 'Saved Transaction',
          amount: 50,
          type: 'expense',
          category: 'food',
          accountId: 'account-1',
          reconciledDate: '2025-01-16T00:00:00.000Z',
        },
      ];

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_transactions') {
          return JSON.stringify(savedTransactions);
        }
        return null;
      });

      const { result } = renderHook(() => useTransactions(), { wrapper });

      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0].description).toBe('Saved Transaction');
      expect(result.current.transactions[0].date).toBeInstanceOf(Date);
      expect(result.current.transactions[0].reconciledDate).toBeInstanceOf(Date);
    });

    it('loads recurring transactions from localStorage', () => {
      const savedRecurring = [
        {
          id: 'recurring-1',
          description: 'Monthly Salary',
          amount: 5000,
          type: 'income',
          category: 'salary',
          accountId: 'account-1',
          frequency: 'monthly',
          startDate: '2025-01-01',
        },
      ];

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_recurring_transactions') {
          return JSON.stringify(savedRecurring);
        }
        return null;
      });

      const { result } = renderHook(() => useTransactions(), { wrapper });

      expect(result.current.recurringTransactions).toHaveLength(1);
      expect(result.current.recurringTransactions[0].description).toBe('Monthly Salary');
    });

    it('handles invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_transactions') {
          return 'invalid json';
        }
        if (key === 'money_management_recurring_transactions') {
          return 'also invalid';
        }
        return null;
      });

      const { result } = renderHook(() => useTransactions(), { wrapper });

      expect(result.current.transactions).toEqual([]);
      expect(result.current.recurringTransactions).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('uses initial data when provided and localStorage is empty', () => {
      const initialTransactions = [createMockTransaction({ id: 'init-1' })];
      const initialRecurring = [createMockRecurringTransaction({ id: 'init-rec-1' })];

      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial(initialTransactions, initialRecurring) }
      );

      expect(result.current.transactions).toEqual(initialTransactions);
      expect(result.current.recurringTransactions).toEqual(initialRecurring);
    });

    it('prefers localStorage over initial data', () => {
      const savedTransactions = [
        {
          id: 'saved-1',
          date: '2025-01-15T00:00:00.000Z',
          description: 'Saved Transaction',
          amount: 50,
          type: 'expense',
          category: 'food',
          accountId: 'account-1',
        },
      ];

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_transactions') {
          return JSON.stringify(savedTransactions);
        }
        return null;
      });

      const initialTransactions = [createMockTransaction({ description: 'Initial Transaction' })];

      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial(initialTransactions) }
      );

      expect(result.current.transactions[0].description).toBe('Saved Transaction');
    });
  });

  describe('addTransaction', () => {
    it('adds a new transaction with generated id', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      const newTransaction = createMockTransaction();

      act(() => {
        result.current.addTransaction(newTransaction);
      });

      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0]).toMatchObject({
        ...newTransaction,
        id: 'mock-uuid-123',
      });
    });

    it('saves to localStorage after adding', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      act(() => {
        result.current.addTransaction(createMockTransaction());
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_transactions',
        expect.stringContaining('Test Transaction')
      );
    });

    it('handles transactions with all optional fields', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      const fullTransaction = createMockTransaction({
        categoryName: 'Food & Dining',
        tags: ['restaurant', 'dinner'],
        notes: 'Birthday dinner',
        cleared: true,
        isSplit: false,
        originalTransactionId: 'original-123',
        isRecurring: true,
        recurringId: 'recurring-456',
        reconciledWith: 'bank-statement-789',
        reconciledDate: new Date('2025-01-21'),
        reconciledNotes: 'Matched with bank',
        isImported: true,
      });

      act(() => {
        result.current.addTransaction(fullTransaction);
      });

      const added = result.current.transactions[0];
      expect(added.tags).toEqual(['restaurant', 'dinner']);
      expect(added.notes).toBe('Birthday dinner');
      expect(added.cleared).toBe(true);
      expect(added.isImported).toBe(true);
    });

    it('supports all transaction types', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      const transactionTypes = ['income', 'expense', 'transfer'] as const;

      transactionTypes.forEach((type, index) => {
        mockUuidV4.mockReturnValueOnce(`transaction-${index}`);
        act(() => {
          result.current.addTransaction(createMockTransaction({
            type,
            description: `${type} transaction`,
          }));
        });
      });

      expect(result.current.transactions).toHaveLength(3);
      transactionTypes.forEach((type, index) => {
        expect(result.current.transactions[index].type).toBe(type);
      });
    });
  });

  describe('updateTransaction', () => {
    it('updates an existing transaction', () => {
      const initialTransaction = createMockTransaction({ id: 'trans-1' });
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial([initialTransaction]) }
      );

      act(() => {
        result.current.updateTransaction('trans-1', {
          description: 'Updated Transaction',
          amount: 200.75,
        });
      });

      const updated = result.current.transactions[0];
      expect(updated.description).toBe('Updated Transaction');
      expect(updated.amount).toBe(200.75);
      expect(updated.type).toBe('expense'); // Unchanged
    });

    it('does nothing if transaction not found', () => {
      const initialTransaction = createMockTransaction({ id: 'trans-1' });
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial([initialTransaction]) }
      );

      act(() => {
        result.current.updateTransaction('non-existent', { description: 'Should not update' });
      });

      expect(result.current.transactions[0].description).toBe('Test Transaction');
    });

    it('saves to localStorage after updating', () => {
      const initialTransaction = createMockTransaction({ id: 'trans-1' });
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial([initialTransaction]) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.updateTransaction('trans-1', { amount: 99.99 });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_transactions',
        expect.stringContaining('99.99')
      );
    });

    it('can update date fields', () => {
      const initialTransaction = createMockTransaction({ id: 'trans-1' });
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial([initialTransaction]) }
      );

      const newDate = new Date('2025-02-15');
      const newReconciledDate = new Date('2025-02-16');

      act(() => {
        result.current.updateTransaction('trans-1', {
          date: newDate,
          reconciledDate: newReconciledDate,
        });
      });

      const updated = result.current.transactions[0];
      expect(updated.date).toEqual(newDate);
      expect(updated.reconciledDate).toEqual(newReconciledDate);
    });
  });

  describe('deleteTransaction', () => {
    it('deletes an existing transaction', () => {
      const transactions = [
        createMockTransaction({ id: 'trans-1' }),
        createMockTransaction({ id: 'trans-2', description: 'Keep this' }),
      ];
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial(transactions) }
      );

      act(() => {
        result.current.deleteTransaction('trans-1');
      });

      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0].id).toBe('trans-2');
    });

    it('does nothing if transaction not found', () => {
      const initialTransaction = createMockTransaction({ id: 'trans-1' });
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial([initialTransaction]) }
      );

      act(() => {
        result.current.deleteTransaction('non-existent');
      });

      expect(result.current.transactions).toHaveLength(1);
    });

    it('saves to localStorage after deletion', () => {
      const transactions = [
        createMockTransaction({ id: 'trans-1' }),
        createMockTransaction({ id: 'trans-2', description: 'Keep this' }),
      ];
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial(transactions) }
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.deleteTransaction('trans-1');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = mockLocalStorage.setItem.mock.calls[0][1];
      expect(savedData).not.toContain('Test Transaction');
      expect(savedData).toContain('Keep this');
    });
  });

  describe('recurring transactions', () => {
    describe('addRecurringTransaction', () => {
      it('adds a new recurring transaction with generated id', () => {
        const { result } = renderHook(() => useTransactions(), { wrapper });

        const newRecurring = createMockRecurringTransaction();

        act(() => {
          result.current.addRecurringTransaction(newRecurring);
        });

        expect(result.current.recurringTransactions).toHaveLength(1);
        expect(result.current.recurringTransactions[0]).toMatchObject({
          ...newRecurring,
          id: 'mock-uuid-123',
        });
      });

      it('uses provided id if given', () => {
        const { result } = renderHook(() => useTransactions(), { wrapper });

        const recurringWithId = createMockRecurringTransaction({ id: 'provided-id' });

        act(() => {
          result.current.addRecurringTransaction(recurringWithId);
        });

        expect(result.current.recurringTransactions[0].id).toBe('provided-id');
      });

      it('handles all frequency types', () => {
        const { result } = renderHook(() => useTransactions(), { wrapper });

        const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;

        frequencies.forEach((frequency, index) => {
          mockUuidV4.mockReturnValueOnce(`recurring-${index}`);
          act(() => {
            result.current.addRecurringTransaction(createMockRecurringTransaction({
              frequency,
              description: `${frequency} transaction`,
            }));
          });
        });

        expect(result.current.recurringTransactions).toHaveLength(4);
        frequencies.forEach((frequency, index) => {
          expect(result.current.recurringTransactions[index].frequency).toBe(frequency);
        });
      });

      it('handles optional fields', () => {
        const { result } = renderHook(() => useTransactions(), { wrapper });

        const fullRecurring = createMockRecurringTransaction({
          endDate: '2025-12-31',
          lastProcessed: '2025-01-15',
        });

        act(() => {
          result.current.addRecurringTransaction(fullRecurring);
        });

        const added = result.current.recurringTransactions[0];
        expect(added.endDate).toBe('2025-12-31');
        expect(added.lastProcessed).toBe('2025-01-15');
      });
    });

    describe('updateRecurringTransaction', () => {
      it('updates an existing recurring transaction', () => {
        const initialRecurring = createMockRecurringTransaction({ id: 'rec-1' });
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial([], [initialRecurring]) }
        );

        act(() => {
          result.current.updateRecurringTransaction('rec-1', {
            description: 'Updated Recurring',
            amount: 2000,
          });
        });

        const updated = result.current.recurringTransactions[0];
        expect(updated.description).toBe('Updated Recurring');
        expect(updated.amount).toBe(2000);
        expect(updated.frequency).toBe('monthly'); // Unchanged
      });

      it('does nothing if recurring transaction not found', () => {
        const initialRecurring = createMockRecurringTransaction({ id: 'rec-1' });
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial([], [initialRecurring]) }
        );

        act(() => {
          result.current.updateRecurringTransaction('non-existent', {
            description: 'Should not update',
          });
        });

        expect(result.current.recurringTransactions[0].description).toBe('Monthly Rent');
      });
    });

    describe('deleteRecurringTransaction', () => {
      it('deletes an existing recurring transaction', () => {
        const recurringTransactions = [
          createMockRecurringTransaction({ id: 'rec-1' }),
          createMockRecurringTransaction({ id: 'rec-2', description: 'Keep this' }),
        ];
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial([], recurringTransactions) }
        );

        act(() => {
          result.current.deleteRecurringTransaction('rec-1');
        });

        expect(result.current.recurringTransactions).toHaveLength(1);
        expect(result.current.recurringTransactions[0].id).toBe('rec-2');
      });

      it('does nothing if recurring transaction not found', () => {
        const initialRecurring = createMockRecurringTransaction({ id: 'rec-1' });
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial([], [initialRecurring]) }
        );

        act(() => {
          result.current.deleteRecurringTransaction('non-existent');
        });

        expect(result.current.recurringTransactions).toHaveLength(1);
      });
    });
  });

  describe('importTransactions', () => {
    it('imports multiple transactions with generated ids', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      const transactionsToImport = [
        createMockTransaction({ description: 'Import 1' }),
        createMockTransaction({ description: 'Import 2' }),
        createMockTransaction({ description: 'Import 3' }),
      ];

      let callCount = 0;
      mockUuidV4.mockImplementation(() => `import-${++callCount}`);

      act(() => {
        result.current.importTransactions(transactionsToImport);
      });

      expect(result.current.transactions).toHaveLength(3);
      expect(result.current.transactions[0].isImported).toBe(true);
      expect(result.current.transactions[1].isImported).toBe(true);
      expect(result.current.transactions[2].isImported).toBe(true);
    });

    it('preserves existing transactions when importing', () => {
      const existingTransaction = createMockTransaction({ id: 'existing-1' });
      const { result } = renderHook(
        () => useTransactions(),
        { wrapper: wrapperWithInitial([existingTransaction]) }
      );

      const transactionsToImport = [
        createMockTransaction({ description: 'Import 1' }),
      ];

      act(() => {
        result.current.importTransactions(transactionsToImport);
      });

      expect(result.current.transactions).toHaveLength(2);
      expect(result.current.transactions[0].id).toBe('existing-1');
      expect(result.current.transactions[1].isImported).toBe(true);
    });

    it('handles empty import array', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      act(() => {
        result.current.importTransactions([]);
      });

      expect(result.current.transactions).toHaveLength(0);
    });
  });

  describe('helper functions', () => {
    describe('getTransactionsByAccount', () => {
      it('returns transactions for specific account', () => {
        const transactions = [
          createMockTransaction({ id: 'trans-1', accountId: 'account-1' }),
          createMockTransaction({ id: 'trans-2', accountId: 'account-2' }),
          createMockTransaction({ id: 'trans-3', accountId: 'account-1' }),
        ];
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial(transactions) }
        );

        const account1Transactions = result.current.getTransactionsByAccount('account-1');

        expect(account1Transactions).toHaveLength(2);
        expect(account1Transactions[0].id).toBe('trans-1');
        expect(account1Transactions[1].id).toBe('trans-3');
      });

      it('returns empty array for non-existent account', () => {
        const transactions = [createMockTransaction({ accountId: 'account-1' })];
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial(transactions) }
        );

        const noTransactions = result.current.getTransactionsByAccount('non-existent');

        expect(noTransactions).toEqual([]);
      });

      it('updates when transactions change', () => {
        const { result } = renderHook(() => useTransactions(), { wrapper });

        let account1Transactions = result.current.getTransactionsByAccount('account-1');
        expect(account1Transactions).toHaveLength(0);

        act(() => {
          result.current.addTransaction(createMockTransaction({ accountId: 'account-1' }));
        });

        account1Transactions = result.current.getTransactionsByAccount('account-1');
        expect(account1Transactions).toHaveLength(1);
      });
    });

    describe('getTransactionsByCategory', () => {
      it('returns transactions for specific category', () => {
        const transactions = [
          createMockTransaction({ id: 'trans-1', category: 'food' }),
          createMockTransaction({ id: 'trans-2', category: 'transport' }),
          createMockTransaction({ id: 'trans-3', category: 'food' }),
        ];
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial(transactions) }
        );

        const foodTransactions = result.current.getTransactionsByCategory('food');

        expect(foodTransactions).toHaveLength(2);
        expect(foodTransactions[0].id).toBe('trans-1');
        expect(foodTransactions[1].id).toBe('trans-3');
      });

      it('returns empty array for non-existent category', () => {
        const transactions = [createMockTransaction({ category: 'food' })];
        const { result } = renderHook(
          () => useTransactions(),
          { wrapper: wrapperWithInitial(transactions) }
        );

        const noTransactions = result.current.getTransactionsByCategory('non-existent');

        expect(noTransactions).toEqual([]);
      });

      it('updates when transactions change', () => {
        const { result } = renderHook(() => useTransactions(), { wrapper });

        let foodTransactions = result.current.getTransactionsByCategory('food');
        expect(foodTransactions).toHaveLength(0);

        act(() => {
          result.current.addTransaction(createMockTransaction({ category: 'food' }));
        });

        foodTransactions = result.current.getTransactionsByCategory('food');
        expect(foodTransactions).toHaveLength(1);
      });
    });
  });

  describe('persistence', () => {
    it('saves transactions to localStorage on every change', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      // Add
      act(() => {
        result.current.addTransaction(createMockTransaction());
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_transactions',
        expect.any(String)
      );

      // Update
      act(() => {
        result.current.updateTransaction('mock-uuid-123', { amount: 999 });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);

      // Delete
      act(() => {
        result.current.deleteTransaction('mock-uuid-123');
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('saves recurring transactions to localStorage on every change', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      // Add
      act(() => {
        result.current.addRecurringTransaction(createMockRecurringTransaction());
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_recurring_transactions',
        expect.any(String)
      );

      // Update
      act(() => {
        result.current.updateRecurringTransaction('mock-uuid-123', { amount: 2000 });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);

      // Delete
      act(() => {
        result.current.deleteRecurringTransaction('mock-uuid-123');
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('throws error when useTransactions is used outside provider', () => {
      expect(() => {
        renderHook(() => useTransactions());
      }).toThrow('useTransactions must be used within TransactionProvider');
    });

    it('throws when localStorage fails', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        act(() => {
          result.current.addTransaction(createMockTransaction());
        });
      }).toThrow('Storage quota exceeded');
    });
  });

  describe('complex scenarios', () => {
    it('handles mixed transaction operations', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      // Add transactions
      act(() => {
        result.current.addTransaction(createMockTransaction({
          description: 'Transaction 1',
          accountId: 'account-1',
          category: 'food',
        }));
      });

      mockUuidV4.mockReturnValueOnce('trans-2');
      act(() => {
        result.current.addTransaction(createMockTransaction({
          description: 'Transaction 2',
          accountId: 'account-2',
          category: 'transport',
        }));
      });

      mockUuidV4.mockReturnValueOnce('trans-3');
      act(() => {
        result.current.addTransaction(createMockTransaction({
          description: 'Transaction 3',
          accountId: 'account-1',
          category: 'food',
        }));
      });

      expect(result.current.transactions).toHaveLength(3);

      // Test filtering
      const account1Trans = result.current.getTransactionsByAccount('account-1');
      const foodTrans = result.current.getTransactionsByCategory('food');

      expect(account1Trans).toHaveLength(2);
      expect(foodTrans).toHaveLength(2);

      // Update and delete
      act(() => {
        result.current.updateTransaction('trans-2', { amount: 500 });
        result.current.deleteTransaction('mock-uuid-123');
      });

      expect(result.current.transactions).toHaveLength(2);
      const updatedTrans = result.current.transactions.find(t => t.id === 'trans-2');
      expect(updatedTrans?.amount).toBe(500);
    });

    it('handles date parsing edge cases', () => {
      const savedWithDates = [
        {
          id: 'date-test',
          date: '2025-01-15T10:30:00.000Z',
          description: 'Date Test',
          amount: 100,
          type: 'expense',
          category: 'test',
          accountId: 'account-1',
          reconciledDate: null, // null date
        },
      ];

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_transactions') {
          return JSON.stringify(savedWithDates);
        }
        return null;
      });

      const { result } = renderHook(() => useTransactions(), { wrapper });

      const transaction = result.current.transactions[0];
      expect(transaction.date).toBeInstanceOf(Date);
      expect(transaction.reconciledDate).toBeUndefined();
    });

    it('handles large transaction sets efficiently', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      // Add many transactions
      const transactions = Array.from({ length: 100 }, (_, i) => 
        createMockTransaction({
          description: `Transaction ${i}`,
          accountId: i % 3 === 0 ? 'account-1' : 'account-2',
          category: i % 2 === 0 ? 'food' : 'transport',
        })
      );

      act(() => {
        result.current.importTransactions(transactions);
      });

      expect(result.current.transactions).toHaveLength(100);

      // Test filtering performance
      const account1Trans = result.current.getTransactionsByAccount('account-1');
      const foodTrans = result.current.getTransactionsByCategory('food');

      expect(account1Trans.length).toBeGreaterThan(0);
      expect(foodTrans.length).toBeGreaterThan(0);
    });
  });
});