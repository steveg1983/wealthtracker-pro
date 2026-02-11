/**
 * transactionsSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import transactionsSlice, {
  addTransaction,
  updateTransaction,
  deleteTransaction
} from './transactionsSlice';

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
};

// Mock storageAdapter
vi.mock('../../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('transactionsSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        transactions: transactionsSlice,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().transactions;
    expect(state).toBeDefined();
    expect(state.transactions).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });

  it('handles add action', () => {
    const newTransaction = {
      description: 'Test Transaction',
      amount: 100,
      type: 'expense' as const,
      category: 'Test',
      accountId: 'acc-1',
      date: '2024-01-01',
    };

    store.dispatch(addTransaction(newTransaction));

    const state = store.getState().transactions;
    expect(state.transactions).toHaveLength(1);
    const { date: _newTransactionDate, ...newTransactionWithoutDate } = newTransaction;
    expect(state.transactions[0]).toMatchObject({
      ...newTransactionWithoutDate,
    });
    expect(new Date(state.transactions[0].date).toISOString()).toBe(new Date('2024-01-01').toISOString());
    expect(state.transactions[0].id).toBeDefined();
  });

  it('handles update action', () => {
    // First add a transaction
    const transaction = {
      description: 'Original',
      amount: 100,
      type: 'expense' as const,
      category: 'Test',
      accountId: 'acc-1',
      date: '2024-01-01',
    };
    
    store.dispatch(addTransaction(transaction));
    const id = store.getState().transactions.transactions[0].id;
    
    // Update it
    store.dispatch(updateTransaction({ id, updates: { description: 'Updated' } }));
    
    const state = store.getState().transactions;
    expect(state.transactions[0].description).toBe('Updated');
  });

  it('handles remove action', () => {
    // First add a transaction
    const transaction = {
      description: 'To be deleted',
      amount: 100,
      type: 'expense' as const,
      category: 'Test',
      accountId: 'acc-1',
      date: '2024-01-01',
    };
    
    store.dispatch(addTransaction(transaction));
    const id = store.getState().transactions.transactions[0].id;
    
    // Delete it
    store.dispatch(deleteTransaction(id));
    
    const state = store.getState().transactions;
    expect(state.transactions).toHaveLength(0);
  });

});
