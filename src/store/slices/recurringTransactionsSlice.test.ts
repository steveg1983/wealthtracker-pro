/**
 * recurringTransactionsSlice Tests
 * Comprehensive tests for the recurring transactions Redux slice
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import recurringTransactionsReducer, {
  setRecurringTransactions,
  addRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  updateLastProcessed,
  loadRecurringTransactions,
  saveRecurringTransactions,
} from './recurringTransactionsSlice';
import type { RecurringTransaction } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';

// Mock storageAdapter
vi.mock('../../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  }
}));

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'test-uuid-123');
global.crypto = {
  ...global.crypto,
  randomUUID: mockUUID,
};

describe('recurringTransactionsSlice', () => {
  const mockRecurringTransaction: RecurringTransaction = {
    id: 'recurring-1',
    description: 'Monthly Rent',
    amount: 1500,
    type: 'expense',
    category: 'Housing',
    accountId: 'acc-1',
    frequency: 'monthly',
    interval: 1,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    nextDate: new Date('2025-02-01'),
    lastProcessed: new Date('2025-01-01'),
    isActive: true,
    tags: ['housing', 'fixed'],
    notes: 'Apartment rent',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15'),
  };

  const createMockRecurringTransaction = (overrides: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
    ...mockRecurringTransaction,
    ...overrides,
  });

  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockUUID.mockReturnValue('test-uuid-123');
    
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        recurringTransactions: recurringTransactionsReducer,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('returns the correct initial state', () => {
      const state = store.getState().recurringTransactions;
      expect(state).toEqual({
        recurringTransactions: [],
        loading: false,
        error: null,
      });
    });
  });

  describe('setRecurringTransactions', () => {
    it('sets recurring transactions and clears error', () => {
      const recurringTransactions = [
        createMockRecurringTransaction({ id: 'recurring-1' }),
        createMockRecurringTransaction({ id: 'recurring-2', description: 'Utility Bill' }),
      ];

      store.dispatch(setRecurringTransactions(recurringTransactions));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toEqual(recurringTransactions);
      expect(state.error).toBeNull();
    });

    it('replaces existing recurring transactions', () => {
      const initialTransactions = [createMockRecurringTransaction({ id: 'recurring-1' })];
      const newTransactions = [
        createMockRecurringTransaction({ id: 'recurring-2' }),
        createMockRecurringTransaction({ id: 'recurring-3' }),
      ];

      store.dispatch(setRecurringTransactions(initialTransactions));
      store.dispatch(setRecurringTransactions(newTransactions));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toEqual(newTransactions);
      expect(state.recurringTransactions).toHaveLength(2);
    });

    it('handles empty array', () => {
      store.dispatch(setRecurringTransactions([createMockRecurringTransaction()]));
      store.dispatch(setRecurringTransactions([]));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toEqual([]);
    });
  });

  describe('addRecurringTransaction', () => {
    it('adds a new recurring transaction with generated id and timestamps', () => {
      const now = new Date('2025-01-20T12:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const newRecurring = {
        description: 'Netflix Subscription',
        amount: 15.99,
        type: 'expense' as const,
        category: 'Entertainment',
        accountId: 'acc-1',
        frequency: 'monthly' as const,
        interval: 1,
        startDate: new Date('2025-01-15'),
        nextDate: new Date('2025-02-15'),
        isActive: true,
        tags: ['subscription'],
      };

      store.dispatch(addRecurringTransaction(newRecurring));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(1);
      expect(state.recurringTransactions[0]).toMatchObject({
        ...newRecurring,
        startDate: newRecurring.startDate.toISOString(),
        nextDate: newRecurring.nextDate.toISOString(),
        id: 'test-uuid-123',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      vi.useRealTimers();
    });

    it('generates different ids for multiple recurring transactions', () => {
      mockUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      const recurring1 = {
        description: 'Recurring 1',
        amount: 100,
        type: 'expense' as const,
        category: 'cat-1',
        accountId: 'acc-1',
        frequency: 'weekly' as const,
        interval: 1,
        startDate: new Date('2025-01-01'),
        nextDate: new Date('2025-01-08'),
        isActive: true,
      };

      const recurring2 = {
        description: 'Recurring 2',
        amount: 200,
        type: 'income' as const,
        category: 'cat-2',
        accountId: 'acc-2',
        frequency: 'monthly' as const,
        interval: 1,
        startDate: new Date('2025-01-01'),
        nextDate: new Date('2025-02-01'),
        isActive: true,
      };

      store.dispatch(addRecurringTransaction(recurring1));
      store.dispatch(addRecurringTransaction(recurring2));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(2);
      expect(state.recurringTransactions[0].id).toBe('uuid-1');
      expect(state.recurringTransactions[1].id).toBe('uuid-2');
    });

    it('handles all frequency types', () => {
      const frequencies: Array<RecurringTransaction['frequency']> = [
        'daily', 'weekly', 'monthly', 'yearly'
      ];

      frequencies.forEach(frequency => {
        store.dispatch(addRecurringTransaction({
          description: `${frequency} transaction`,
          amount: 100,
          type: 'expense',
          category: 'Test',
          accountId: 'acc-1',
          frequency,
          interval: 1,
          startDate: new Date('2025-01-01'),
          nextDate: new Date('2025-01-02'),
          isActive: true,
        }));
      });

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(frequencies.length);
      state.recurringTransactions.forEach((rt, index) => {
        expect(rt.frequency).toBe(frequencies[index]);
      });
    });

    it('handles different intervals', () => {
      const intervals = [1, 2, 3, 4, 6, 12];

      intervals.forEach(interval => {
        store.dispatch(addRecurringTransaction({
          description: `Every ${interval} months`,
          amount: 100,
          type: 'expense',
          category: 'Test',
          accountId: 'acc-1',
          frequency: 'monthly',
          interval,
          startDate: new Date('2025-01-01'),
          nextDate: new Date('2025-02-01'),
          isActive: true,
        }));
      });

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(intervals.length);
      state.recurringTransactions.forEach((rt, index) => {
        expect(rt.interval).toBe(intervals[index]);
      });
    });

    it('adds recurring transaction with optional fields', () => {
      const recurringWithOptionals = {
        description: 'Gym Membership',
        amount: 50,
        type: 'expense' as const,
        category: 'Health',
        accountId: 'acc-1',
        frequency: 'monthly' as const,
        interval: 1,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        nextDate: new Date('2025-02-01'),
        lastProcessed: new Date('2025-01-01'),
        isActive: true,
        tags: ['health', 'fitness'],
        notes: 'Annual gym membership paid monthly',
      };

      store.dispatch(addRecurringTransaction(recurringWithOptionals));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0]).toMatchObject({
        ...recurringWithOptionals,
        startDate: (recurringWithOptionals.startDate as Date).toISOString(),
        endDate: (recurringWithOptionals.endDate as Date)?.toISOString(),
        lastProcessed: (recurringWithOptionals.lastProcessed as Date).toISOString(),
        nextDate: (recurringWithOptionals.nextDate as Date).toISOString(),
      });
    });

    it('adds inactive recurring transaction', () => {
      const inactiveRecurring = {
        description: 'Paused Subscription',
        amount: 20,
        type: 'expense' as const,
        category: 'Software',
        accountId: 'acc-1',
        frequency: 'monthly' as const,
        interval: 1,
        startDate: new Date('2025-01-01'),
        nextDate: new Date('2025-02-01'),
        isActive: false,
      };

      store.dispatch(addRecurringTransaction(inactiveRecurring));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0].isActive).toBe(false);
    });
  });

  describe('updateRecurringTransaction', () => {
    it('updates an existing recurring transaction', () => {
      const now = new Date('2025-01-20T12:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const transactions = [
        createMockRecurringTransaction({ id: 'recurring-1', amount: 1000 }),
        createMockRecurringTransaction({ id: 'recurring-2' }),
      ];

      store.dispatch(setRecurringTransactions(transactions));
      store.dispatch(updateRecurringTransaction({
        id: 'recurring-1',
        updates: { amount: 1200, description: 'Updated Rent' },
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0]).toMatchObject({
        id: 'recurring-1',
        amount: 1200,
        description: 'Updated Rent',
        updatedAt: now.toISOString(),
      });
      expect(state.recurringTransactions[1].amount).toBe(1500); // Unchanged

      vi.useRealTimers();
    });

    it('does nothing if recurring transaction not found', () => {
      const transactions = [createMockRecurringTransaction({ id: 'recurring-1' })];
      store.dispatch(setRecurringTransactions(transactions));
      
      store.dispatch(updateRecurringTransaction({
        id: 'non-existent',
        updates: { amount: 999 },
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toEqual(transactions);
    });

    it('can update multiple fields', () => {
      store.dispatch(setRecurringTransactions([createMockRecurringTransaction({ id: 'recurring-1' })]));
      
      store.dispatch(updateRecurringTransaction({
        id: 'recurring-1',
        updates: {
          description: 'Multi-update',
          amount: 2000,
          frequency: 'weekly',
          interval: 2,
          isActive: false,
          tags: ['updated', 'new-tag'],
        },
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0]).toMatchObject({
        description: 'Multi-update',
        amount: 2000,
        frequency: 'weekly',
        interval: 2,
        isActive: false,
        tags: ['updated', 'new-tag'],
      });
    });

    it('can update dates', () => {
      const newStartDate = new Date('2025-02-01');
      const newEndDate = new Date('2026-01-31');
      const newNextDate = new Date('2025-03-01');

      store.dispatch(setRecurringTransactions([createMockRecurringTransaction({ id: 'recurring-1' })]));
      
      store.dispatch(updateRecurringTransaction({
        id: 'recurring-1',
        updates: {
          startDate: newStartDate,
          endDate: newEndDate,
          nextDate: newNextDate,
        },
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0].startDate).toEqual(newStartDate);
      expect(state.recurringTransactions[0].endDate).toEqual(newEndDate);
      expect(state.recurringTransactions[0].nextDate).toEqual(newNextDate);
    });

    it('preserves other properties', () => {
      const original = createMockRecurringTransaction({ 
        id: 'recurring-1',
        tags: ['original', 'tags'],
        notes: 'Original notes'
      });
      
      store.dispatch(setRecurringTransactions([original]));
      store.dispatch(updateRecurringTransaction({
        id: 'recurring-1',
        updates: { amount: 2000 },
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0].tags).toEqual(['original', 'tags']);
      expect(state.recurringTransactions[0].notes).toBe('Original notes');
    });
  });

  describe('deleteRecurringTransaction', () => {
    it('deletes a recurring transaction by id', () => {
      const transactions = [
        createMockRecurringTransaction({ id: 'recurring-1' }),
        createMockRecurringTransaction({ id: 'recurring-2' }),
        createMockRecurringTransaction({ id: 'recurring-3' }),
      ];

      store.dispatch(setRecurringTransactions(transactions));
      store.dispatch(deleteRecurringTransaction('recurring-2'));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(2);
      expect(state.recurringTransactions.find(rt => rt.id === 'recurring-2')).toBeUndefined();
      expect(state.recurringTransactions[0].id).toBe('recurring-1');
      expect(state.recurringTransactions[1].id).toBe('recurring-3');
    });

    it('does nothing if recurring transaction not found', () => {
      const transactions = [createMockRecurringTransaction({ id: 'recurring-1' })];
      store.dispatch(setRecurringTransactions(transactions));
      
      store.dispatch(deleteRecurringTransaction('non-existent'));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toEqual(transactions);
    });

    it('handles deleting the last recurring transaction', () => {
      store.dispatch(setRecurringTransactions([createMockRecurringTransaction({ id: 'recurring-1' })]));
      store.dispatch(deleteRecurringTransaction('recurring-1'));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toEqual([]);
    });
  });

  describe('updateLastProcessed', () => {
    it('updates last processed date', () => {
      const now = new Date('2025-01-20T12:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const lastProcessedDate = new Date('2025-01-15');
      const transactions = [
        createMockRecurringTransaction({ id: 'recurring-1', lastProcessed: new Date('2025-01-01') }),
        createMockRecurringTransaction({ id: 'recurring-2' }),
      ];

      store.dispatch(setRecurringTransactions(transactions));
      store.dispatch(updateLastProcessed({ 
        id: 'recurring-1', 
        lastProcessed: lastProcessedDate 
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0]).toMatchObject({
        id: 'recurring-1',
        lastProcessed: lastProcessedDate.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(state.recurringTransactions[1].lastProcessed).toEqual(mockRecurringTransaction.lastProcessed); // Unchanged

      vi.useRealTimers();
    });

    it('does nothing if recurring transaction not found', () => {
      const transactions = [createMockRecurringTransaction({ id: 'recurring-1' })];
      store.dispatch(setRecurringTransactions(transactions));
      
      store.dispatch(updateLastProcessed({ 
        id: 'non-existent', 
        lastProcessed: new Date() 
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0].lastProcessed).toEqual(mockRecurringTransaction.lastProcessed);
    });

    it('sets lastProcessed for transaction without previous date', () => {
      const transaction = createMockRecurringTransaction({ 
        id: 'recurring-1',
        lastProcessed: undefined 
      });
      const processedDate = new Date('2025-01-20');

      store.dispatch(setRecurringTransactions([transaction]));
      store.dispatch(updateLastProcessed({ 
        id: 'recurring-1', 
        lastProcessed: processedDate 
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0].lastProcessed).toEqual(processedDate.toISOString());
    });

    it('can update to future date', () => {
      const futureDate = new Date('2025-12-31');
      
      store.dispatch(setRecurringTransactions([createMockRecurringTransaction({ id: 'recurring-1' })]));
      store.dispatch(updateLastProcessed({ 
        id: 'recurring-1', 
        lastProcessed: futureDate 
      }));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions[0].lastProcessed).toEqual(futureDate.toISOString());
    });
  });

  describe('async thunks', () => {
    describe('loadRecurringTransactions', () => {
      it('loads recurring transactions successfully', async () => {
        const mockTransactions = [
          createMockRecurringTransaction({ id: 'recurring-1' }),
          createMockRecurringTransaction({ id: 'recurring-2' }),
        ];

        (storageAdapter.get as any).mockResolvedValue(mockTransactions);

        await store.dispatch(loadRecurringTransactions());

        const state = store.getState().recurringTransactions;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.recurringTransactions).toEqual(mockTransactions);
        expect(storageAdapter.get).toHaveBeenCalledWith('recurringTransactions');
      });

      it('handles empty storage', async () => {
        (storageAdapter.get as any).mockResolvedValue(null);

        await store.dispatch(loadRecurringTransactions());

        const state = store.getState().recurringTransactions;
        expect(state.recurringTransactions).toEqual([]);
        expect(state.loading).toBe(false);
      });

      it('sets loading state while pending', async () => {
        let resolvePromise: (value: any) => void;
        const promise = new Promise((resolve) => {
          resolvePromise = resolve;
        });
        (storageAdapter.get as any).mockReturnValue(promise);

        const loadPromise = store.dispatch(loadRecurringTransactions());

        // Check loading state immediately
        let state = store.getState().recurringTransactions;
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();

        // Resolve and wait
        resolvePromise!([]);
        await loadPromise;

        state = store.getState().recurringTransactions;
        expect(state.loading).toBe(false);
      });

      it('handles load errors', async () => {
        const errorMessage = 'Storage error';
        (storageAdapter.get as any).mockRejectedValue(new Error(errorMessage));

        await store.dispatch(loadRecurringTransactions());

        const state = store.getState().recurringTransactions;
        expect(state.loading).toBe(false);
        expect(state.error).toBe(errorMessage);
        expect(state.recurringTransactions).toEqual([]);
      });

      it('uses default error message if none provided', async () => {
        (storageAdapter.get as any).mockRejectedValue(new Error());

        await store.dispatch(loadRecurringTransactions());

        const state = store.getState().recurringTransactions;
        expect(state.error).toBe('Failed to load recurring transactions');
      });
    });

    describe('saveRecurringTransactions', () => {
      it('saves recurring transactions successfully', async () => {
        const transactions = [
          createMockRecurringTransaction({ id: 'recurring-1' }),
          createMockRecurringTransaction({ id: 'recurring-2' }),
        ];

        (storageAdapter.set as any).mockResolvedValue(undefined);

        await store.dispatch(saveRecurringTransactions(transactions));

        expect(storageAdapter.set).toHaveBeenCalledWith('recurringTransactions', transactions);
        
        const state = store.getState().recurringTransactions;
        expect(state.recurringTransactions).toEqual(transactions);
      });

      it('updates state after saving', async () => {
        const initialTransactions = [createMockRecurringTransaction({ id: 'recurring-1' })];
        const newTransactions = [
          createMockRecurringTransaction({ id: 'recurring-2' }),
          createMockRecurringTransaction({ id: 'recurring-3' }),
        ];

        store.dispatch(setRecurringTransactions(initialTransactions));
        
        (storageAdapter.set as any).mockResolvedValue(undefined);
        await store.dispatch(saveRecurringTransactions(newTransactions));

        const state = store.getState().recurringTransactions;
        expect(state.recurringTransactions).toEqual(newTransactions);
      });

      it('handles save errors gracefully', async () => {
        const transactions = [createMockRecurringTransaction()];
        (storageAdapter.set as any).mockRejectedValue(new Error('Save failed'));

        // saveRecurringTransactions doesn't have error handling in extraReducers
        // The action will be rejected but won't update the state
        const resultAction = await store.dispatch(saveRecurringTransactions(transactions));
        expect(resultAction.type).toMatch(/rejected$/);
      });
    });
  });

  describe('reducer behavior', () => {
    it('returns current state for unknown action', () => {
      const initialState = store.getState().recurringTransactions;
      
      store.dispatch({ type: 'unknown/action' });
      
      const newState = store.getState().recurringTransactions;
      expect(newState).toEqual(initialState);
    });

    it('maintains immutability', () => {
      const transaction = createMockRecurringTransaction({ id: 'recurring-1' });
      store.dispatch(setRecurringTransactions([transaction]));
      
      const stateBefore = store.getState().recurringTransactions;
      const transactionsBefore = stateBefore.recurringTransactions;
      
      store.dispatch(updateRecurringTransaction({
        id: 'recurring-1',
        updates: { amount: 2000 },
      }));
      
      const stateAfter = store.getState().recurringTransactions;
      
      // References should be different
      expect(stateAfter).not.toBe(stateBefore);
      expect(stateAfter.recurringTransactions).not.toBe(transactionsBefore);
      expect(stateAfter.recurringTransactions[0]).not.toBe(transactionsBefore[0]);
      
      // Original should be unchanged
      expect(transactionsBefore[0].amount).toBe(1500);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple operations in sequence', () => {
      // Add initial transactions
      store.dispatch(setRecurringTransactions([
        createMockRecurringTransaction({ id: 'recurring-1' }),
        createMockRecurringTransaction({ id: 'recurring-2' }),
      ]));

      // Add new transaction
      store.dispatch(addRecurringTransaction({
        description: 'New Subscription',
        amount: 25,
        type: 'expense',
        category: 'Software',
        accountId: 'acc-1',
        frequency: 'monthly',
        interval: 1,
        startDate: new Date('2025-01-15'),
        nextDate: new Date('2025-02-15'),
        isActive: true,
      }));

      // Update existing transaction
      store.dispatch(updateRecurringTransaction({
        id: 'recurring-1',
        updates: { isActive: false },
      }));

      // Update last processed
      store.dispatch(updateLastProcessed({
        id: 'recurring-2',
        lastProcessed: new Date('2025-01-20'),
      }));

      // Delete a transaction
      store.dispatch(deleteRecurringTransaction('recurring-1'));

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(2);
      expect(state.recurringTransactions.find(rt => rt.id === 'recurring-1')).toBeUndefined();
      expect(state.recurringTransactions[0].lastProcessed).toEqual(new Date('2025-01-20').toISOString());
      expect(state.recurringTransactions[1].description).toBe('New Subscription');
    });

    it('handles various transaction types and frequencies', () => {
      const combinations = [
        { type: 'income', frequency: 'monthly' },
        { type: 'expense', frequency: 'weekly' },
        { type: 'income', frequency: 'yearly' },
        { type: 'expense', frequency: 'daily' },
      ];

      combinations.forEach((combo, index) => {
        store.dispatch(addRecurringTransaction({
          description: `${combo.type} ${combo.frequency}`,
          amount: (index + 1) * 100,
          type: combo.type as 'income' | 'expense',
          category: 'Test',
          accountId: 'acc-1',
          frequency: combo.frequency as RecurringTransaction['frequency'],
          interval: 1,
          startDate: new Date('2025-01-01'),
          nextDate: new Date('2025-01-02'),
          isActive: true,
        }));
      });

      const state = store.getState().recurringTransactions;
      expect(state.recurringTransactions).toHaveLength(4);
      
      const incomeCount = state.recurringTransactions.filter(rt => rt.type === 'income').length;
      const expenseCount = state.recurringTransactions.filter(rt => rt.type === 'expense').length;
      expect(incomeCount).toBe(2);
      expect(expenseCount).toBe(2);
    });
  });
});
